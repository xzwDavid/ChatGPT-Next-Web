// PopupContent.tsx
import React, { useState } from "react";
import "./PopupContent.scss";
import styles from "./home.module.scss";
import { ChatMessage } from "@/app/store";

interface PopupContentProps {
  onClose: () => void;
  comment: (input: string) => void;
}

export function PopupContent(props: PopupContentProps) {
  const [inputValue, setInputValue] = useState("");

  const handleSubmitClick = () => {
    //alert(`你输入的内容是：${inputValue}`);
    props.comment(inputValue);
    setInputValue("");
    props.onClose();
  };

  return (
    <div className="popup-container">
      <textarea
        className="input-field"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
      />
      <div className="button-container">
        <button
          className={styles["chat-message-top-action"]}
          onClick={handleSubmitClick}
        >
          Comment
        </button>
        <button
          className={styles["chat-message-top-action"]}
          onClick={props.onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default PopupContent;
