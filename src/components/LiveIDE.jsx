"use client";

import { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import Split from "react-split";
import axios from "axios";

const LANGUAGE_ID = {
  javascript: 63,
  python: 71,
  java: 62,
  c: 48,
  cpp: 52,
};

const DEFAULT_CODE = {
  javascript: 'console.log("Hello, World!");',
  python: 'print("Hello, World!")',
  java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}',
  c: '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}',
  cpp: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}',
};

export default function LiveIDE() {
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState(DEFAULT_CODE["javascript"]);
  const [output, setOutput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [theme, setTheme] = useState("vs-dark");
  const editorRef = useRef(null);

  function handleEditorDidMount(editor, monaco) {
    editorRef.current = editor;
  }

  function handleEditorChange(value, event) {
    setCode(value);
  }

  const runCode = async () => {
    setIsLoading(true);
    setOutput("Running...");

    try {
      const response = await axios.post(
        "https://judge0-ce.p.rapidapi.com/submissions",
        {
          source_code: code,
          language_id: LANGUAGE_ID[language],
          stdin: "",
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-RapidAPI-Key": process.env.NEXT_PUBLIC_RAPIDAPI_KEY,
            "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
          },
        }
      );

      const token = response.data.token;
      let result;
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const resultResponse = await axios.get(
          `https://judge0-ce.p.rapidapi.com/submissions/${token}`,
          {
            headers: {
              "X-RapidAPI-Key": process.env.NEXT_PUBLIC_RAPIDAPI_KEY,
              "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
            },
          }
        );

        result = resultResponse.data;

        if (result.status && result.status.id > 2) {
          // Status > 2 means processing is done
          break;
        }

        attempts++;
      }

      // Enhanced error handling
      let outputText = "";

      if (result.status && result.status.id === 3) {
        // Accepted (success)
        outputText =
          result.stdout || "Program executed successfully with no output";
      } else if (result.status && result.status.id === 6) {
        // Compilation Error
        outputText =
          result.compile_output || "Compilation error (no details available)";
      } else if (result.stderr) {
        // Runtime Error
        outputText = result.stderr;
      } else if (result.compile_output) {
        // Other compilation issues
        outputText = result.compile_output;
      } else if (result.message) {
        // API error message
        outputText = result.message;
      } else {
        // Fallback
        outputText = "An unknown error occurred during execution";
      }

      // Add status description if available
      if (result.status) {
        outputText = `Status: ${result.status.description}\n\n${outputText}`;
      }

      setOutput(outputText);
    } catch (error) {
      console.error("Error:", error);
      setOutput(
        `Error executing code: ${error.message}\n\n${
          error.response?.data?.message || ""
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setCode(DEFAULT_CODE[language] || "");
  }, [language]);

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <div className="p-4 bg-gray-800 flex justify-between items-center">
        <div>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-gray-700 text-white p-2 rounded mr-4"
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="c">C</option>
            <option value="cpp">C++</option>
          </select>

          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="bg-gray-700 text-white p-2 rounded"
          >
            <option value="vs-dark">Dark</option>
            <option value="light">Light</option>
            <option value="hc-black">High Contrast</option>
          </select>
        </div>

        <button
          onClick={runCode}
          disabled={isLoading}
          className={`px-4 py-2 rounded ${
            isLoading ? "bg-gray-600" : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {isLoading ? "Running..." : "Run Code"}
        </button>
      </div>

      <div className="flex flex-grow">
        <div className="flex-1 p-2">
          <Editor
            height="100%"
            defaultLanguage={language}
            language={language}
            theme={theme}
            value={code}
            onChange={handleEditorChange}
            onMount={handleEditorDidMount}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              wordWrap: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>

        <div className="flex-1 p-4 bg-gray-800 overflow-auto">
          <h3 className="text-lg font-semibold mb-2">Output</h3>
          <pre
            className={`whitespace-pre-wrap p-3 rounded text-sm font-mono ${
              output.includes("error") ||
              output.includes("Error") ||
              output.includes("fail")
                ? "bg-red-900 text-red-100"
                : "bg-gray-900 text-white"
            }`}
          >
            {output}
          </pre>
        </div>
      </div>
    </div>
  );
}