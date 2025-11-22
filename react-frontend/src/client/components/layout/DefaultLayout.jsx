// src/client/components/layout/DefaultLayout.jsx
import { useEffect } from "react";
import { useSelector } from "react-redux";
import HeaderComponents from "../Header/HeaderComponents";
import FooterComponents from "../Footer/FooterComponents";
import { Layout, ConfigProvider } from "antd";
import ElfsightWidget from "../../components/Elfsight/ElfsightWidget";
import ChatWidget from "../Chat/ChatWidget";
import PropTypes from "prop-types";

const { Content } = Layout;

const DefaultLayout = ({ children }) => {
  // === Lấy thông tin khách đang đăng nhập từ Redux (giống Profile.jsx) ===
  const authCustomer = useSelector((state) => state.auth);

  // Đây mới là customerId đúng
  const customerId = authCustomer?.user?.data?.id || null;

  // StaffId: chọn 1 nhân viên / quản lý spa cố định (id trong bảng `users`)
  // Gợi ý: đặt trong .env cho dễ đổi:
  // VITE_DEFAULT_STAFF_ID=752490373359738127  (ví dụ id user "admin@gmail.com")
  const staffId = "752490373359738127";

  // Token: nếu route client chat KHÔNG dùng auth middleware thì có thể không cần
  const authToken =
    localStorage.getItem("tokenClient") ||
    localStorage.getItem("access_token_customer") ||
    localStorage.getItem("access_token") ||
    "";

  console.log("customerId >>>", customerId);
  console.log("staffId >>>", staffId);

  // === Load script Elfsight như cũ ===
  useEffect(() => {
    if (document.querySelector('script[data-elfsight-loaded="1"]')) return;

    const script = document.createElement("script");
    script.src = "https://elfsightcdn.com/platform.js";
    script.async = true;
    script.setAttribute("data-elfsight-loaded", "1");
    document.body.appendChild(script);
  }, []);

  return (
    <ConfigProvider
      theme={{
        components: {
          Menu: {
            horizontalItemSelectedColor: "#E05265",
            itemSelectedColor: "#E05265",
          },
        },
        token: {
          colorPrimary: "#E05265",
        },
      }}
    >
      <Layout
        style={{
          backgroundColor: "#fff",
        }}
      >
        <div
          style={{
            position: "relative",
          }}
        >
          <HeaderComponents />
          <Content
            style={{
              marginTop: "50px",
            }}
          >
            {children}
          </Content>
          <FooterComponents />
          <ElfsightWidget />

          {/* Chat realtime */}
          <ChatWidget
            mode="client"
            staffId={staffId}
            customerId={customerId}
            authToken={authToken}
          />
        </div>
      </Layout>
    </ConfigProvider>
  );
};

DefaultLayout.propTypes = {
  children: PropTypes.node,
};

export default DefaultLayout;
