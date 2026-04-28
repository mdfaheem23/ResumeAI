import React from "react";
import { useNavigate } from "react-router-dom";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";

const DemoOne = () => {
  const navigate = useNavigate();

  const handleSendMessage = (message: string, files?: File[]) => {
    console.log("Message:", message);
    console.log("Files:", files);

    // Navigate to the main builder page with initial message
    navigate("/builder", {
      state: {
        initialMessage: message,
        files: files,
      },
    });
  };

  return (
    <div className="flex w-full h-screen items-center justify-center bg-[radial-gradient(125%_125%_at_50%_101%,rgba(245,87,2,1)_10.5%,rgba(245,120,2,1)_16%,rgba(245,140,2,1)_17.5%,rgba(245,170,100,1)_25%,rgba(238,174,202,1)_40%,rgba(202,179,214,1)_65%,rgba(148,201,233,1)_100%)]">
      {/* Main Content Container */}
      <div className="flex flex-col items-center justify-center w-full max-w-[600px] px-4">
        {/* Title Section */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-2">Resume Builder</h1>
          <p className="text-white/70 text-sm">
            Upload your resume and ask questions about it
          </p>
        </div>

        {/* Input Box */}
        <div className="w-full">
          <PromptInputBox
            onSend={handleSendMessage}
            placeholder="Ask about your resume..."
          />
        </div>
      </div>
    </div>
  );
};

export { DemoOne };
