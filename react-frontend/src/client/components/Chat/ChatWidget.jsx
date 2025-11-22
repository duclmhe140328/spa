// src/client/components/Chat/ChatWidget.jsx
import { useEffect, useState, useRef, useCallback } from "react";
import Pusher from "pusher-js";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";

// mode = "client" | "admin"
// - client: dùng trên website spa (nút tròn nổi)
// - admin: có thể tái dùng nếu sau này cần, nhưng hiện tại chỉ client dùng
export default function ChatWidget({
  mode = "client",
  staffId, // id ở bảng users (spa / staff)
  customerId, // id ở bảng customers
  authToken, // token của customer (mode=client) hoặc staff (mode=admin)
  defaultOpen = false,
}) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(defaultOpen);

  // auto scroll
  const messagesEndRef = useRef(null);
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // log cho chắc
  console.log("ChatWidget props:", { mode, staffId, customerId, authToken });

  const prefix = mode === "admin" ? "v0.0.1/admin" : "v0.0.1/client";

  // ===================== LẤY LỊCH SỬ TIN NHẮN (DÙNG CHUNG) =====================
  const fetchMessages = useCallback(async () => {
    if (!staffId || !customerId) {
      console.warn("Missing staffId hoặc customerId => không fetch messages");
      return;
    }

    try {
      setLoading(true);

      const qs =
        mode === "admin" ? `customer_id=${customerId}` : `user_id=${staffId}`;

      const res = await fetch(`${API_BASE}/${prefix}/chat/messages?${qs}`, {
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
      });

      if (!res.ok) throw new Error("Fetch messages failed");

      const data = await res.json();
      console.log("Client fetched messages:", data);
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch messages error:", err);
    } finally {
      setLoading(false);
    }
  }, [staffId, customerId, mode, prefix, authToken]);

  // initial load
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // scroll xuống cuối khi messages thay đổi
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // ===================== REALTIME PUSHER =====================
  useEffect(() => {
    if (!staffId || !customerId) return;

    const appKey = import.meta.env.VITE_PUSHER_APP_KEY;
    const cluster = import.meta.env.VITE_PUSHER_APP_CLUSTER || "ap1";

    if (!appKey) {
      console.warn("VITE_PUSHER_APP_KEY missing – realtime disabled");
      return;
    }

    const pusher = new Pusher(appKey, {
      cluster,
      forceTLS: true,
    });

    const channelName = `chat.${staffId}.${customerId}`;
    console.log("Client subscribe channel:", channelName);
    const channel = pusher.subscribe(channelName);

    channel.bind("message.sent", (data) => {
      console.log("Client Pusher message.sent:", data);
      // Không xử lý shape data nữa => mỗi lần có event thì reload list
      fetchMessages();
    });

    return () => {
      channel.unbind("message.sent");
      pusher.unsubscribe(channelName);
      pusher.disconnect();
    };
  }, [staffId, customerId, fetchMessages]);

  // ===================== GỬI TIN NHẮN =====================
  const handleSend = async () => {
    if (!text.trim()) return;
    if (!staffId || !customerId) {
      console.warn("Không có staffId hoặc customerId => không gửi tin");
      return;
    }

    try {
      setLoading(true);

      const body =
        mode === "admin"
          ? { customer_id: customerId, message: text.trim() }
          : { user_id: staffId, message: text.trim() };

      const res = await fetch(`${API_BASE}/${prefix}/chat/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Send message failed");

      await res.json();
      setText("");

      // Sau khi gửi xong, reload lại list từ server cho chắc
      fetchMessages();
    } catch (err) {
      console.error("Send message error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ===================== RENDER UI (CLIENT – NÚT NỔI) =====================
  return (
    <>
      {/* FAB – nút tròn chat realtime, lệch sang trái để không đè Elfsight */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "fixed",
          bottom: 24,
          right: 96,
          width: 60,
          height: 60,
          borderRadius: "50%",
          border: "none",
          background:
            "radial-gradient(circle at 20% 20%, #ffe6f0, #e05265 60%, #b1203e)",
          boxShadow: "0 10px 25px rgba(0,0,0,0.35)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
        }}
      >
        <span
          style={{
            fontSize: 26,
            color: "#fff",
          }}
        >
          💬
        </span>

        {messages.length > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              width: 20,
              height: 20,
              borderRadius: "999px",
              background: "#ff4d4f",
              color: "#fff",
              fontSize: 11,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 0 2px #fff",
            }}
          >
            {messages.length > 9 ? "9+" : messages.length}
          </span>
        )}
      </button>

      {/* PANEL CHAT realtime */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 100,
            right: 24,
            width: 420,
            height: 480,
            borderRadius: 20,
            background: "#fff",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 14px 40px rgba(0,0,0,0.35)",
            fontSize: 14,
            zIndex: 9999,
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "12px 16px",
              background: "linear-gradient(135deg, #ff7aa2, #e05265, #b1203e)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>Chat với Spa Sakura</div>
              <div style={{ fontSize: 12, opacity: 0.9 }}>
                Thường trả lời trong vài phút 💗
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{
                border: "none",
                background: "transparent",
                color: "#fff",
                fontSize: 18,
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>

          {/* Danh sách tin nhắn */}
          <div
            style={{
              flex: 1,
              padding: "12px 12px 8px 12px",
              overflowY: "auto",
              background:
                "radial-gradient(circle at top left, #fff8fb, #ffeef4)",
            }}
          >
            {messages.length === 0 && !loading && (
              <div
                style={{
                  marginTop: 20,
                  textAlign: "center",
                  color: "#666",
                  fontSize: 13,
                }}
              >
                Chưa có tin nhắn nào.
                <br />
                Hãy nhắn cho Spa nếu bạn cần tư vấn liệu trình 💗
              </div>
            )}

            {messages.map((msg) => {
              const isMe =
                (mode === "client" && msg.sender_type === 1) ||
                (mode === "admin" && msg.sender_type === 2);

              return (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    justifyContent: isMe ? "flex-end" : "flex-start",
                    marginBottom: 6,
                  }}
                >
                  <div
                    style={{
                      maxWidth: "75%",
                      padding: "8px 12px",
                      borderRadius: 18,
                      borderBottomLeftRadius: isMe ? 18 : 4,
                      borderBottomRightRadius: isMe ? 4 : 18,
                      background: isMe ? "#e05265" : "#fff",
                      color: isMe ? "#fff" : "#333",
                      boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
                      fontSize: 13,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {msg.message}
                  </div>
                </div>
              );
            })}

            {/* mốc để auto scroll */}
            <div ref={messagesEndRef} />
          </div>

          {/* Ô nhập tin nhắn */}
          <div
            style={{
              borderTop: "1px solid #f0f0f0",
              padding: "8px 10px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#fff",
            }}
          >
            <textarea
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nhập tin nhắn..."
              style={{
                flex: 1,
                resize: "none",
                borderRadius: 999,
                border: "1px solid #f0f0f0",
                padding: "8px 14px",
                fontSize: 13,
                outline: "none",
              }}
            />
            <button
              onClick={handleSend}
              disabled={loading || !text.trim()}
              style={{
                border: "none",
                borderRadius: 999,
                padding: "8px 16px",
                background: loading || !text.trim() ? "#ffd6de" : "#e05265",
                color: "#fff",
                fontWeight: 600,
                cursor: loading || !text.trim() ? "not-allowed" : "pointer",
                fontSize: 13,
              }}
            >
              Gửi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
