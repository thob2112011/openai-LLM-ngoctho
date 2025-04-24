import { useState, useRef, useEffect } from "react";
import "./App.css";

function App() {
  const [input, setInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [articleContextReady, setArticleContextReady] = useState(false);
  const [pdfContextReady, setPdfContextReady] = useState(false);

  const scrollToBottom = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  const isValidURL = (text) => {
    try {
      new URL(text);
      return true;
    } catch {
      return false;
    }
  };

  const handlePDFUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPdfFile(file);
    setUploadStatus("Đang tải...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      await fetch("http://127.0.0.1:8000/upload_pdf", {
        method: "POST",
        body: formData,
      });
      setUploadStatus("✅ Đã xử lý tài liệu");
      setPdfContextReady(true);
    } catch {
      setUploadStatus("❌ Tải thất bại");
      setPdfFile(null);
      setPdfContextReady(false);
    }
  };

  const handleRemovePDF = () => {
    setPdfFile(null);
    setUploadStatus("");
    setPdfContextReady(false);
  };

  const handleArticleLoad = async (url) => {
    try {
      const res = await fetch("http://127.0.0.1:8000/load_article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const result = await res.json();
      if (res.ok) {
        setUploadStatus("✅ Đã phân tích bài báo");
        setArticleContextReady(true);
      } else {
        setUploadStatus("❌ Không thể tải bài báo");
        setArticleContextReady(false);
      }
    } catch {
      setUploadStatus("❌ Không thể tải bài báo");
      setArticleContextReady(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() && !pdfFile) return;

    const isURL = isValidURL(input.trim());
    const userText = input.trim();

    const newMessages = [...chatHistory];
    if (userText || isURL) {
      newMessages.push({ role: "user", content: userText });
      setChatHistory(newMessages);
    }

    setInput("");
    setLoading(true);

    let endpoint = "chat";
    let payload = { prompt: userText };

    if (pdfFile) {
      endpoint = "ask_pdf";
      payload = { query: userText || "Tóm tắt nội dung tài liệu PDF" };
    } else if (isURL) {
      await handleArticleLoad(userText);
      endpoint = "ask_article";
      payload = { question: userText || "Tóm tắt nội dung bài báo" };
    } else if (articleContextReady) {
      endpoint = "ask_article";
      payload = { question: userText };
    } else if (pdfContextReady) {
      endpoint = "ask_pdf";
      payload = { query: userText };
    }

    try {
      const response = await fetch(`http://127.0.0.1:8000/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let botReply = "";
      if (endpoint === "chat") {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          botReply += chunk;
          setChatHistory([
            ...newMessages,
            { role: "assistant", content: botReply },
          ]);
        }
      } else {
        const data = await response.json();
        botReply = data.answer;
        setChatHistory([
          ...newMessages,
          { role: "assistant", content: botReply },
        ]);
      }
    } catch (error) {
      setChatHistory([
        ...newMessages,
        { role: "assistant", content: "Đã xảy ra lỗi khi phản hồi." },
      ]);
    }

    setLoading(false);
  };

  return (
    <div className="app-container">
      <div className="navbar">
        <h1 className="title">Tôi là trợ lý của bạn!</h1>
      </div>

      <div className="chat-window">
        {chatHistory.map((msg, idx) => (
          <div key={idx} className={`chat-message ${msg.role}`}>
            <div className="message-bubble">{msg.content}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
        {loading && <div className="typing-indicator">🤖 Đang phản hồi...</div>}
      </div>

      {pdfFile && (
        <div className="pdf-preview">
          <span>📄 {pdfFile.name}</span>
          <button onClick={handleRemovePDF} className="close-btn">
            ✖
          </button>
        </div>
      )}

      <div className="input-bar">
        <label htmlFor="pdf-upload" className="upload-button">
          ＋
        </label>
        <input
          id="pdf-upload"
          type="file"
          accept="application/pdf"
          className="hidden-input"
          onChange={handlePDFUpload}
        />
        <input
          className="text-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Hỏi tôi gì đó"
        />
        <button
          className="send-button"
          onClick={sendMessage}
          disabled={loading}
        >
          ⬆
        </button>
      </div>

      {uploadStatus && <p className="status-text">{uploadStatus}</p>}
    </div>
  );
}

export default App;
