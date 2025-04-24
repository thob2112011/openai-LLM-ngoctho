# Chatbot LLM (OpenAI)

Dự án gồm:

- **BE**: Python FastAPI gọi API OpenAI.
- **FE**: ReactJS sử dụng Vite.

## Yêu cầu hệ thống

- `fastapi`
- `uvicorn`
- `openai>=1.0.0`
- `langchain`
- `tiktoken`
- `faiss-cpu`
- `python-dotenv`
- `PyMuPDF`
- `newspaper3k`
- `lxml-html-clean`

---

## Cách cài đặt và chạy dự án

### 1. Clone project

```bash
git clone https://github.com/thob2112011/openai-LLM-ngoctho.git
cd chatbot-llm
```

### 2. BACK-END

tải các thư viện cần thiết

- 'pip install -r requirements.txt'

tạo file .env

- echo "OPENAI_API_KEY=my-api-key" >> .env

- cd BE
  chạy lệnh
  'uvicorn main:app --reload --host 127.0.0.1 --port 8000'

### 3. FRONT-END

- cd FE
  chạy lệnh
  'npm run dev'

### 4. Truy cập trang

- Truy cập để sử dụng bằng URL: http://localhost:5173
