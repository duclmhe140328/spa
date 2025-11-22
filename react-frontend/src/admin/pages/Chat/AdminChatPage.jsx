// src/admin/pages/Chat/AdminChatPage.jsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  Layout,
  Input,
  List,
  Avatar,
  Badge,
  Spin,
  Empty,
  Typography,
} from "antd";
import {
  MessageOutlined,
  SearchOutlined,
  UserOutlined,
  PhoneOutlined,
} from "@ant-design/icons";
import Pusher from "pusher-js";

const { Sider, Content } = Layout;
const { Text, Title } = Typography;

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";

const AdminChatPage = () => {
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(false);

  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const [search, setSearch] = useState("");

  // tạm thời: staffId fix cứng, token đọc từ localStorage
  const staffId = "752490373359738127";
  const authToken =
    localStorage.getItem("tokenAdmin") ||
    localStorage.getItem("access_token_staff") ||
    localStorage.getItem("access_token") ||
    "";

  // auto scroll xuống cuối khung chat
  const messagesEndRef = useRef(null);
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // ===== Fetch danh sách hội thoại (dùng lại được) =====
  const fetchConversations = useCallback(async () => {
    if (!authToken) {
      console.warn("Không có token admin => không gọi conversations");
      return;
    }

    try {
      setLoadingConversations(true);

      const res = await fetch(`${API_BASE}/v0.0.1/admin/chat/conversations`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!res.ok) {
        const text = await res.text();
        console.error(
          "Conversations API error:",
          res.status,
          text || res.statusText
        );
        throw new Error("Fetch conversations failed");
      }

      const data = await res.json();
      setConversations(Array.isArray(data) ? data : []);

      // nếu chưa chọn customer thì auto chọn dòng đầu
      if (!selectedCustomerId && Array.isArray(data) && data.length > 0) {
        setSelectedCustomerId(data[0].customer_id);
        setSelectedCustomer(data[0]);
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoadingConversations(false);
    }
  }, [authToken, selectedCustomerId]);

  // gọi 1 lần khi vào trang
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // ===== Lấy lịch sử chat (dùng chung) =====
  const fetchMessages = useCallback(async () => {
    if (!selectedCustomerId || !authToken) return;

    try {
      setLoadingMessages(true);
      const res = await fetch(
        `${API_BASE}/v0.0.1/admin/chat/messages?customer_id=${selectedCustomerId}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (!res.ok) throw new Error("Fetch messages failed");

      const data = await res.json();
      console.log("Admin fetched messages:", data);
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch messages error:", err);
    } finally {
      setLoadingMessages(false);
    }
  }, [selectedCustomerId, authToken]);

  // Lấy lịch sử khi chọn customer
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // ===== Realtime Pusher – kênh STAFF để auto update hội thoại + messages =====
  useEffect(() => {
    if (!staffId) return;

    const appKey = import.meta.env.VITE_PUSHER_APP_KEY;
    const cluster = import.meta.env.VITE_PUSHER_APP_CLUSTER || "ap1";
    if (!appKey) {
      console.warn("VITE_PUSHER_APP_KEY missing – admin realtime disabled");
      return;
    }

    const pusher = new Pusher(appKey, {
      cluster,
      forceTLS: true,
    });

    const channelName = `staff.${staffId}`;
    console.log("Admin subscribe staff channel:", channelName);
    const channel = pusher.subscribe(channelName);

    channel.bind("message.sent", (data) => {
      console.log("Admin staff message.sent:", data);
      // luôn reload lại list hội thoại (để có khách mới / cập nhật last_message)
      fetchConversations();

      // nếu đang mở đúng customer này thì reload luôn messages
      if (data && data.customer_id && data.customer_id === selectedCustomerId) {
        fetchMessages();
      }
    });

    return () => {
      channel.unbind("message.sent");
      pusher.unsubscribe(channelName);
      pusher.disconnect();
    };
  }, [staffId, fetchConversations, fetchMessages, selectedCustomerId]);

  // ===== Gửi tin nhắn từ admin =====
  const handleSend = async (e) => {
    // chặn submit form hoặc hành vi default khác
    if (e && e.preventDefault) {
      e.preventDefault();
    }

    if (!text.trim() || !selectedCustomerId || !authToken) return;

    try {
      setSending(true);

      const res = await fetch(`${API_BASE}/v0.0.1/admin/chat/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          customer_id: selectedCustomerId,
          message: text.trim(),
        }),
      });

      if (!res.ok) throw new Error("Send message failed");

      await res.json();
      setText("");

      // Sau khi gửi, load lại messages (event staff.* cũng sẽ đến nhưng làm thêm cho mượt)
      fetchMessages();
      // và cập nhật last_message / last_time bên trái
      fetchConversations();
    } catch (err) {
      console.error("Send message error:", err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); // chặn xuống dòng + chặn submit mặc định
      handleSend();       // gửi tin
    }
  };

  // ===== Filter theo search =====
  const filteredConversations = useMemo(() => {
    if (!search.trim()) return conversations;
    const keyword = search.toLowerCase();
    return conversations.filter((c) => {
      const name = (c.customer_name || "").toLowerCase();
      const phone = (c.customer_phone || "").toLowerCase();
      return name.includes(keyword) || phone.includes(keyword);
    });
  }, [conversations, search]);

  const handleSelectConversation = (item) => {
    setSelectedCustomerId(item.customer_id);
    setSelectedCustomer(item);
  };

  const totalConversations = conversations.length;
  const totalUnread = conversations.reduce(
    (sum, c) => sum + (c.unread_count || 0),
    0
  );

  return (
    <Layout
      style={{
        background: "#fff",
        height: "calc(100vh - 80px)",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
      }}
    >
      {/* ========== SIDEBAR – DANH SÁCH HỘI THOẠI ========== */}
      <Sider
        width={360}
        style={{
          background:
            "linear-gradient(135deg, #ffe6f0 0%, #ffeef6 40%, #fff 100%)",
          borderRight: "1px solid #f5c4d6",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header sidebar */}
        <div
          style={{
            padding: "16px 20px 10px",
            borderBottom: "1px solid rgba(255,255,255,0.6)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle at 20% 20%, #ffe6f0, #f25f85)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
              }}
            >
              <MessageOutlined style={{ color: "#fff", fontSize: 20 }} />
            </div>
            <div>
              <Title
                level={5}
                style={{ margin: 0, color: "#c0204a", letterSpacing: 0.2 }}
              >
                Hộp thư khách hàng
              </Title>
              <Text style={{ fontSize: 12, color: "#a44f6a" }}>
                Chat realtime với khách hàng từ website
              </Text>
            </div>
          </div>

          {/* Search */}
          <Input
            size="large"
            allowClear
            placeholder="Tìm theo tên / SĐT..."
            prefix={<SearchOutlined style={{ color: "#c79aac" }} />}
            style={{
              marginTop: 14,
              borderRadius: 999,
              borderColor: "#ffd0df",
              background: "#fff",
            }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* Thống kê nhỏ */}
          <div
            style={{
              marginTop: 10,
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              color: "#b26782",
            }}
          >
            <span>Tổng: {totalConversations} hội thoại</span>
            <span>Chưa đọc: {totalUnread}</span>
          </div>
        </div>

        {/* Danh sách hội thoại */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loadingConversations ? (
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Spin tip="Đang tải hội thoại..." />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div
              style={{
                paddingTop: 40,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Empty
                description="Chưa có cuộc chat nào"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Khi khách hàng nhắn từ website, cuộc chat sẽ xuất hiện ở đây.
              </Text>
            </div>
          ) : (
            <List
              dataSource={filteredConversations}
              renderItem={(item) => {
                const isActive = item.customer_id === selectedCustomerId;

                return (
                  <List.Item
                    style={{
                      padding: "12px 16px",
                      cursor: "pointer",
                      background: isActive ? "#ffedf4" : "transparent",
                      borderLeft: isActive
                        ? "3px solid #e05265"
                        : "3px solid transparent",
                      transition: "background 0.2s, border-left 0.2s",
                    }}
                    onClick={() => handleSelectConversation(item)}
                  >
                    <List.Item.Meta
                      avatar={
                        <Badge
                          dot={item.unread_count > 0}
                          offset={[-2, 30]}
                          color="#ff4d4f"
                        >
                          <Avatar
                            src={item.customer_avatar}
                            icon={<UserOutlined />}
                            style={{
                              backgroundColor: "#ffe6ea",
                              color: "#e05265",
                            }}
                          />
                        </Badge>
                      }
                      title={
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              fontWeight: isActive ? 600 : 500,
                              color: isActive ? "#d52c56" : "#333",
                            }}
                          >
                            {item.customer_name || "Khách lạ"}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              color: "#999",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {item.last_time || ""}
                          </span>
                        </div>
                      }
                      description={
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                          }}
                        >
                          {/* Số điện thoại */}
                          {item.customer_phone && (
                            <span
                              style={{
                                fontSize: 12,
                                color: "#b45a73",
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <PhoneOutlined
                                style={{ fontSize: 11, color: "#d85c7e" }}
                              />
                              {item.customer_phone}
                            </span>
                          )}

                          {/* Tin nhắn cuối */}
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 12,
                                color: "#777",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                flex: 1,
                              }}
                            >
                              {item.last_message || "Chưa có tin nhắn"}
                            </span>

                            {item.unread_count > 0 && (
                              <span
                                style={{
                                  minWidth: 20,
                                  height: 20,
                                  borderRadius: 999,
                                  background: "#ff4d4f",
                                  color: "#fff",
                                  fontSize: 11,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  padding: "0 6px",
                                }}
                              >
                                {item.unread_count > 9
                                  ? "9+"
                                  : item.unread_count}
                              </span>
                            )}
                          </div>
                        </div>
                      }
                    />
                  </List.Item>
                );
              }}
            />
          )}
        </div>
      </Sider>

      {/* ========== KHUNG CHAT BÊN PHẢI ========== */}
      <Content
        style={{
          background: "#fff",
          position: "relative",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {!selectedCustomerId ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <MessageOutlined style={{ fontSize: 40, color: "#e05265" }} />
            <div style={{ fontWeight: 600, fontSize: 16 }}>
              Chọn một khách hàng để bắt đầu chat
            </div>
            <div style={{ fontSize: 13, color: "#888" }}>
              Tất cả tin nhắn từ website sẽ hiển thị ở đây.
            </div>
          </div>
        ) : (
          <>
            {/* Header thông tin khách */}
            <div
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid #f5f5f5",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background:
                  "linear-gradient(135deg, #ffe6f0 0%, #ffeef6 40%, #fff 100%)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar
                  size={40}
                  src={selectedCustomer?.customer_avatar}
                  icon={<UserOutlined />}
                  style={{
                    backgroundColor: "#ffe6ea",
                    color: "#e05265",
                  }}
                />
                <div>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 15,
                      color: "#c0204a",
                    }}
                  >
                    {selectedCustomer?.customer_name || "Khách lạ"}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#a45d75",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <PhoneOutlined style={{ fontSize: 11 }} />
                    {selectedCustomer?.customer_phone || "Chưa cập nhật SĐT"}
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: "4px 12px",
                  borderRadius: 999,
                  background: "#e6fff5",
                  color: "#1a9c68",
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                ● Đang trực tuyến
              </div>
            </div>

            {/* Khung chat */}
            <div
              style={{
                flex: 1,
                padding: "14px 20px",
                background: "#fff5f8",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  paddingRight: 6,
                }}
              >
                {loadingMessages ? (
                  <div
                    style={{
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Spin tip="Đang tải tin nhắn..." />
                  </div>
                ) : messages.length === 0 ? (
                  <div
                    style={{
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "column",
                      gap: 8,
                      color: "#b8748b",
                    }}
                  >
                    <MessageOutlined style={{ fontSize: 40 }} />
                    <div style={{ fontWeight: 500 }}>Chưa có tin nhắn nào</div>
                    <div style={{ fontSize: 13 }}>
                      Hãy bắt đầu cuộc trò chuyện với khách hàng.
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((msg) => {
                      const isMe = msg.sender_type === 2; // 2 = admin/staff
                      return (
                        <div
                          key={msg.id}
                          style={{
                            display: "flex",
                            justifyContent: isMe ? "flex-end" : "flex-start",
                            marginBottom: 8,
                          }}
                        >
                          <div
                            style={{
                              maxWidth: "65%",
                              padding: "8px 12px",
                              borderRadius: 18,
                              borderBottomLeftRadius: isMe ? 18 : 4,
                              borderBottomRightRadius: isMe ? 4 : 18,
                              background: isMe ? "#e05265" : "#fff",
                              color: isMe ? "#fff" : "#333",
                              boxShadow: "0 3px 8px rgba(0,0,0,0.08)",
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
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Thanh nhập tin nhắn */}
              <form
                onSubmit={handleSend}
                style={{
                  marginTop: 8,
                  padding: "8px 10px",
                  background: "#fff",
                  borderRadius: 999,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
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
                    border: "none",
                    padding: "8px 12px",
                    fontSize: 13,
                    outline: "none",
                  }}
                />
                <button
                  type="submit"
                  disabled={sending || !text.trim()}
                  style={{
                    border: "none",
                    borderRadius: 999,
                    padding: "8px 16px",
                    background:
                      sending || !text.trim() ? "#ffd6de" : "#e05265",
                    color: "#fff",
                    fontWeight: 600,
                    cursor:
                      sending || !text.trim()
                        ? "not-allowed"
                        : "pointer",
                    fontSize: 13,
                    minWidth: 70,
                  }}
                >
                  Gửi
                </button>
              </form>
            </div>
          </>
        )}
      </Content>
    </Layout>
  );
};

export default AdminChatPage;
