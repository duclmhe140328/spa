import React from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { PublicRoutes } from "./config/routes";

import AuthMiddleware from "../authMiddleware";
import AdminLayout from "@admin/components/layout/AdminLayout";
import { Button, Result } from "antd";

import LoginPage from "./pages/authen/loginPage";
import ForgotPage from "./modules/authen/compoment/forgotPage";
import Newpassword from "./modules/authen/compoment/newpassPage";
import AdminChatPage from "./pages/Chat/AdminChatPage";

// log role

const AppAdmin = () => {
  return (
    <Routes>
      {/* Các route admin bình thường lấy từ PublicRoutes */}
      {PublicRoutes.map((route, index) => (
        <Route
          key={index}
          path={route.path}
          element={
            <AuthMiddleware requiredRole={route.requiredRole}>
              <AdminLayout>{route.element}</AdminLayout>
            </AuthMiddleware>
          }
        />
      ))}

      {/* === ROUTE CHAT ADMIN (realtime) === 
          /admin/chat/:customerId  (vì AppAdmin đang mounted ở /admin/*)
      */}
      <Route
        path="chat/:customerId"
        element={
          <AuthMiddleware requiredRole="admin">
            <AdminLayout>
              <AdminChatPage />
            </AdminLayout>
          </AuthMiddleware>
        }
      />

      {/* Auth pages (không dùng AdminLayout) */}
      <Route path="dangnhap" element={<LoginPage />} />
      <Route path="quenmatkhau" element={<ForgotPage />} />
      <Route path="matkhaumoi" element={<Newpassword />} />

      {/* Route 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

// Component hiển thị cho trang 404
const NotFound = () => {
  const navigate = useNavigate();

  return (
    <Result
      status="404"
      title="404"
      subTitle="Xin lỗi, trang bạn truy cập không tồn tại."
      extra={
        <Button type="primary" onClick={() => navigate("/admin")}>
          Trở về trang chủ
        </Button>
      }
    />
  );
};

export default AppAdmin;
