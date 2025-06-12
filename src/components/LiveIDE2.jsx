'use client'

import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import Split from 'react-split';
import axios from 'axios';

const LANGUAGE_ID = {
  javascript: 63,
  python: 71,
  java: 62,
  c: 48,
  cpp: 52,
};

const DEFAULT_CODE = {
  javascript: 'function solve(input) {\n  // Your code here\n  return input;\n}',
  python: 'def solve(input):\n  # Your code here\n  return input',
  java: 'public class Solution {\n  public static Object solve(Object input) {\n    // Your code here\n    return input;\n  }\n}',
  c: '// Not supported for this demo',
  cpp: '// Not supported for this demo',
  
};

export default function LiveIDE2() {
  const [language, setLanguage] = useState('javascript');
  const [code, setCode] = useState(DEFAULT_CODE['javascript']);
  const [output, setOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [theme, setTheme] = useState('vs-dark');
  const [problem, setProblem] = useState(null);
  const [hint, setHint] = useState('');
  const [userInput, setUserInput] = useState('');
  const [expectedOutput, setExpectedOutput] = useState('');
  const [topic, setTopic] = useState('arrays');
  const [difficulty, setDifficulty] = useState('easy');
  const editorRef = useRef(null);

  function handleEditorDidMount(editor, monaco) {
    editorRef.current = editor;
  }

  function handleEditorChange(value, event) {
    setCode(value);
  }

  const generateProblem = async () => {
    setIsLoading(true);
    setOutput('Generating problem...');
    
    try {
      const prompt = `Generate a ${difficulty} level coding problem about ${topic} in ${language}. 
      Return a JSON object with these fields: 
      {
        "problem": "clear problem statement",
        "hint": "a helpful hint",
        "input": "example input value",
        "output": "expected output for the given input"
      }`;
      
      // Using Gemini API (you'll need to replace with actual Gemini API call)
      const response = await axios.post(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
        {
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        },
        {
          params: {
            key: process.env.NEXT_PUBLIC_GEMINI_API_KEY
          }
        }
      );

      // Parse the response (adjust based on actual Gemini response structure)
      const responseText = response.data.candidates[0].content.parts[0].text;
      const jsonStart = responseText.indexOf('{');
      const jsonEnd = responseText.lastIndexOf('}') + 1;
      const jsonString = responseText.slice(jsonStart, jsonEnd);
      const problemData = JSON.parse(jsonString);

      setProblem(problemData.problem);
      setHint(problemData.hint);
      setUserInput(problemData.input);
      setExpectedOutput(problemData.output);
      setOutput('Problem generated successfully!');
      
      // Reset code to template
      setCode(DEFAULT_CODE[language] || '');
    } catch (error) {
      console.error('Error generating problem:', error);
      setOutput(`Error generating problem: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const runCode = async () => {
    if (!problem) {
      setOutput('Please generate a problem first');
      return;
    }
    
    setIsLoading(true);
    setOutput('Running your solution...');
    
    try {
      // Prepare the full code with input handling
      let fullCode = code;
      if (language === 'javascript') {
        fullCode += `\nconsole.log(JSON.stringify(solve(${userInput}))`;
      } else if (language === 'python') {
        fullCode += `\nprint(solve(${userInput}))`;
      } else if (language === 'java') {
        fullCode += `\npublic class Main {\n  public static void main(String[] args) {\n    System.out.println(solve(${userInput}));\n  }\n}`;
      }

      const response = await axios.post(
        'https://judge0-ce.p.rapidapi.com/submissions',
        {
          source_code: fullCode,
          language_id: LANGUAGE_ID[language],
          stdin: '',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-RapidAPI-Key': process.env.NEXT_PUBLIC_RAPIDAPI_KEY,
            'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
          },
        }
      );

      const token = response.data.token;
      let result;
      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const resultResponse = await axios.get(
          `https://judge0-ce.p.rapidapi.com/submissions/${token}`,
          {
            headers: {
              'X-RapidAPI-Key': process.env.NEXT_PUBLIC_RAPIDAPI_KEY,
              'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
            },
          }
        );

        result = resultResponse.data;
        
        if (result.status && result.status.id > 2) {
          break;
        }
        
        attempts++;
      }

      let outputText = '';
      let isCorrect = false;
      
      if (result.status && result.status.id === 3) { // Accepted
        const actualOutput = result.stdout.trim();
        isCorrect = actualOutput === expectedOutput;
        
        outputText = `Your output: ${actualOutput}\n\n`;
        outputText += `Expected output: ${expectedOutput}\n\n`;
        outputText += isCorrect 
          ? '✅ Correct solution!'
          : '❌ Wrong answer. Try again!';
      } 
      else if (result.status && result.status.id === 6) { // Compilation Error
        outputText = `Compilation Error:\n${result.compile_output}`;
      }
      else if (result.stderr) { // Runtime Error
        outputText = `Runtime Error:\n${result.stderr}`;
      }
      else if (result.compile_output) { // Other compilation issues
        outputText = `Error:\n${result.compile_output}`;
      }
      else if (result.message) { // API error message
        outputText = result.message;
      }
      else { // Fallback
        outputText = 'An unknown error occurred during execution';
      }

      setOutput(outputText);
    } catch (error) {
      console.error('Error:', error);
      setOutput(`Error executing code: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setCode(DEFAULT_CODE[language] || '');
  }, [language]);

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <div className="p-4 bg-gray-800 flex justify-between items-center">
        <div className="flex space-x-4">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-gray-700 text-white p-2 rounded"
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
          </select>
          
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Enter topic (e.g., arrays)"
            className="bg-gray-700 text-white p-2 rounded w-40"
          />
          
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="bg-gray-700 text-white p-2 rounded"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="bg-gray-700 text-white p-2 rounded"
          >
            <option value="vs-dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={generateProblem}
            disabled={isLoading}
            className={`px-4 py-2 rounded ${isLoading ? 'bg-gray-600' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            Generate Problem
          </button>
          <button
            onClick={runCode}
            disabled={isLoading || !problem}
            className={`px-4 py-2 rounded ${isLoading ? 'bg-gray-600' : 'bg-green-600 hover:bg-green-700'} ${!problem ? 'opacity-50' : ''}`}
          >
            {isLoading ? 'Running...' : 'Submit Solution'}
          </button>
        </div>
      </div>
      
      <Split
        className="flex-grow"
        direction="vertical"
        sizes={[40, 60]}
        minSize={100}
      >
        <Split
          className="flex"
          direction="horizontal"
          sizes={[50, 50]}
          minSize={300}
        >
          <div className="p-4 overflow-auto">
            <h2 className="text-xl font-bold mb-2">Problem Statement</h2>
            {problem ? (
              <>
                <div className="mb-4 whitespace-pre-wrap">{problem}</div>
                <div className="bg-gray-800 p-3 rounded mb-4">
                  <h3 className="font-semibold mb-1">Example Input:</h3>
                  <pre className="bg-gray-900 p-2 rounded">{userInput}</pre>
                </div>
                <div className="bg-gray-800 p-3 rounded">
                  <h3 className="font-semibold mb-1">Expected Output:</h3>
                  <pre className="bg-gray-900 p-2 rounded">{expectedOutput}</pre>
                </div>
              </>
            ) : (
              <div className="text-gray-400">Generate a problem to get started</div>
            )}
          </div>
          
          <div className="p-4 overflow-auto border-l border-gray-700">
            <h2 className="text-xl font-bold mb-2">Hint</h2>
            {hint ? (
              <div className="bg-gray-800 p-4 rounded whitespace-pre-wrap">{hint}</div>
            ) : (
              <div className="text-gray-400">Generate a problem to see hints</div>
            )}
          </div>
        </Split>
        
        <Split
          className="flex"
          direction="horizontal"
          sizes={[70, 30]}
          minSize={300}
        >
          <div className="p-2">
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
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          </div>
          
          <div className="p-4 bg-gray-800 overflow-auto border-l border-gray-700">
            <h3 className="text-lg font-semibold mb-2">Output</h3>
            <pre 
              className={`whitespace-pre-wrap p-3 rounded text-sm font-mono min-h-32 ${
                output.includes('Error') || output.includes('Wrong answer') 
                  ? 'bg-red-900 text-red-100' 
                  : output.includes('Correct') 
                    ? 'bg-green-900 text-green-100'
                    : 'bg-gray-900 text-white'
              }`}
            >
              {output || 'Run your code to see output'}
            </pre>
          </div>
        </Split>
      </Split>
    </div>
  );
}