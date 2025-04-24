import os
import fitz
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from langchain.embeddings.openai import OpenAIEmbeddings
from langchain.vectorstores import FAISS
from langchain.text_splitter import CharacterTextSplitter, RecursiveCharacterTextSplitter
from newspaper import Article
from openai import OpenAI

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========== CHAT STREAMING ==========
@app.post("/chat")
async def chat(req: Request):
    data = await req.json()
    prompt = data.get("prompt", "")

    def stream():
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
                    messages=[
            {
                "role": "system",
                "content": (
                    "Bạn là trợ lý AI thông minh. "
                    "Luôn trả lời các câu hỏi một cách chi tiết, "
                    "trình bày rõ ràng, chia thành các mục nhỏ hoặc gạch đầu dòng nếu phù hợp. "
                    "Giải thích cặn kẽ nhưng dễ hiểu."
                ),
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
            stream=True,
        )
        for chunk in response:
            yield chunk.choices[0].delta.content or ""

    return StreamingResponse(stream(), media_type="text/plain")


# ========== PDF Q&A ==========
documents = []

@app.post("/upload_pdf")
async def upload_pdf(file: UploadFile = File(...)):
    pdf = fitz.open(stream=await file.read(), filetype="pdf")
    text = "\n".join([page.get_text() for page in pdf])
    splitter = CharacterTextSplitter(chunk_size=500, chunk_overlap=100)
    docs = splitter.split_text(text)
    global documents
    documents = FAISS.from_texts(docs, OpenAIEmbeddings())
    return {"status": "uploaded"}


@app.post("/ask_pdf")
async def ask_pdf(req: Request):
    data = await req.json()
    query = data.get("query", "")
    result = documents.similarity_search(query, k=3)
    context = "\n".join([r.page_content for r in result])

    prompt = f"Dựa vào nội dung sau, hãy trả lời câu hỏi:\n\n{context}\n\nCâu hỏi: {query}"
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": prompt}]
    )
    return {"answer": response.choices[0].message.content}


# ========== ARTICLE Q&A ==========
article_vector_store = None

@app.post("/load_article")
async def load_article(req: Request):
    data = await req.json()
    raw_input = data.get("url", "")
    import re
    url_match = re.search(r'https?://\S+', raw_input)
    if not url_match:
        return JSONResponse(status_code=400, content={"error": "Không tìm thấy URL hợp lệ trong chuỗi đầu vào."})

    url = url_match.group(0)
    try:
        article = Article(url)
        article.download()
        article.parse()
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": f"Không thể tải bài báo: {str(e)}"})

    text = article.text
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=100)
    chunks = splitter.split_text(text)

    global article_vector_store
    article_vector_store = FAISS.from_texts(chunks, OpenAIEmbeddings())
    return {"message": "Đã tải và phân tích bài báo."}

@app.post("/ask_article")
async def ask_article(req: Request):
    data = await req.json()
    question = data.get("question", "")
    global article_vector_store

    # Nếu chưa có dữ liệu, kiểm tra có phải link không và gọi lại load_article
    if not article_vector_store and is_valid_url(question):
        from newspaper import Article
        article = Article(question)
        article.download()
        article.parse()

        text = article.text
        splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=100)
        chunks = splitter.split_text(text)
        article_vector_store = FAISS.from_texts(chunks, OpenAIEmbeddings())
        question = "Tóm tắt nội dung bài báo"

    if not article_vector_store:
        return JSONResponse(status_code=400, content={"error": "Bài báo chưa được tải hoặc không hợp lệ."})

    docs = article_vector_store.similarity_search(question, k=3)
    context = "\n".join([doc.page_content for doc in docs])

    prompt = f"""Dưới đây là nội dung bài báo:\n{context}\n\nDựa vào đó, hãy trả lời câu hỏi sau thật chi tiết và chia ý nếu có thể:\n{question}"""

    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": prompt}]
    )
    return {"answer": response.choices[0].message.content}

