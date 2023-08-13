import React, { useState } from "react";

interface CollapsibleElementProps {
  message: any;
  content?: string;
}

const CollapsibleElement: ({
  message,
  content,
}: {
  message: any;
  content?: any;
}) => JSX.Element = ({ message, content }) => {
  //const con = content;
  //alert(content);
  return (
    <div>
      <>
        <h2>Original answer:</h2>
        <p>{content}</p>
      </>
      <></>
      {message.map(
        (
          doc: {
            pageContent:
              | string
              | number
              | boolean
              | React.ReactElement<
                  any,
                  string | React.JSXElementConstructor<any>
                >
              | React.ReactFragment
              | React.ReactPortal
              | null
              | undefined;
            metadata: {
              source: string;
            };
          },
          index: React.Key,
        ) => {
          const sourceParts = doc.metadata.source.split("/"); // 假设文件路径中使用的是斜杠“/”
          const lastFolderName = sourceParts[sourceParts.length - 1]; // 获取最后一个文件夹名

          return (
            <div key={index}>
              <div>
                <h2>Page Content:</h2>
                <p>{doc.pageContent}</p>
                <h2>Source:</h2>
                <p>{lastFolderName}</p> {/* 显示最后一个文件夹名 */}
              </div>
            </div>
          );
        },
      )}
    </div>
  );
};

export default CollapsibleElement;
