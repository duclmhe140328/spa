// src/client/components/Elfsight/ElfsightWidget.jsx
import { useEffect } from "react";

export default function ElfsightWidget() {
  useEffect(() => {
    // Nếu script đã tồn tại thì không thêm nữa
    if (document.querySelector("#elfsight-platform-script")) return;

    const script = document.createElement("script");
    // URL chuẩn của Elfsight
    script.src = "https://static.elfsight.com/platform/platform.js";
    script.defer = true;
    script.id = "elfsight-platform-script";
    script.setAttribute("data-use-service-core", ""); // giống snippet Elfsight
    document.body.appendChild(script);
  }, []);

  return (
    <div
      className="elfsight-app-d6e9b9fd-af21-42af-9db3-667a7e97c196"
      // bỏ lazy để chắc chắn nó hiện luôn
    />
  );
}
