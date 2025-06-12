'use client'

import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import Split from 'react-split';
import axios from 'axios';

function LiveIDEbyGem() {
  // Judge0 Language IDs and Default Code Templates
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
    c: '// C is not supported in this demo',
    cpp: '// C++ is not supported in this demo',
  };

  // State variables
  const [language, setLanguage] = useState('javascript');
  const [code, setCode] = useState(DEFAULT_CODE['javascript']);
  const [theme, setTheme] = useState('vs-dark');
  const [topic, setTopic] = useState('arrays');
  const [difficulty, setDifficulty] = useState('easy');
  const [problem, setProblem] = useState('');
  const [hint, setHint] = useState('');
  const [userInput, setUserInput] = useState('');
  const [expectedOutput, setExpectedOutput] = useState('');
  const [problemExplanation, setProblemExplanation] = useState('');
  const [solutionSketch, setSolutionSketch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [output, setOutput] = useState('Welcome! Generate a problem to begin.');
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [tempTopic, setTempTopic] = useState(topic);
  const [showProblemStatement, setShowProblemStatement] = useState(true);
  const [showHint, setShowHint] = useState(true);
  const [showProblemExplanation, setShowProblemExplanation] = useState(false);
  const [showSolutionSketch, setShowSolutionSketch] = useState(false);
  const editorRef = useRef(null);

  function handleEditorDidMount(editor, monaco) {
    editorRef.current = editor;
  }

  function handleEditorChange(value, event) {
    setCode(value);
  }

  // Effect to update code template when language changes
  useEffect(() => {
    setCode(DEFAULT_CODE[language] || '');
  }, [language]);

  const callGeminiAPI = async (currentPrompt, setStateFunction, successMessage, errorMessagePrefix) => {
    try {
      let chatHistory = [];
      chatHistory.push({ role: "user", parts: [{ text: currentPrompt }] });

      const payload = {
        contents: chatHistory,
        generationConfig: {
          responseMimeType: currentPrompt.startsWith('Generate a ') ? "application/json" : undefined,
          responseSchema: currentPrompt.startsWith('Generate a ') ? {
            type: "OBJECT",
            properties: {
              problem: { type: "STRING" },
              hint: { type: "STRING" },
              input: { type: "STRING" },
              output: { type: "STRING" },
            },
            required: ["problem", "hint", "input", "output"],
          } : undefined,
        },
      };

      const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY; 
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        
        const responseText = result.candidates[0].content.parts[0].text;
        
        if (payload.generationConfig.responseSchema) {
          const parsedData = JSON.parse(responseText);
          setStateFunction(parsedData);
        } else {
          setStateFunction(responseText);
        }
        setOutput(successMessage);
        return true;
      } else {
        console.error('Unexpected API response structure:', result);
        setOutput(`${errorMessagePrefix}: Unexpected response from API. Please try again.`);
        return false;
      }
    } catch (error) {
      console.error(`${errorMessagePrefix}:`, error);
      setOutput(`${errorMessagePrefix}: ${error.message || 'Check console for details.'}`);
      return false;
    }
  };
  const prompt = `
    Generate a ${difficulty} level coding problem about ${topic} in ${language}.

    If the **${topic}** is clearly not a relevant or directly applicable concept for the **${language}** (e.g., 'React' for 'C++', or 'file system' for 'HTML-only'), then **instead of a problem**, return a JSON object with a single "error" field containing a descriptive message.
    
    Return a JSON object fro error with this fields:
    {
    "error": "The topic 'React' is not directly applicable to 'C++'. Please choose a topic relevant to C++."
    }

    example problem responce:
    Otherwise, if the topic is suitable for the language, return a JSON object with these fields:
    // "problem": "clear problem statement",
    // "hint": "a helpful hint",
    // "input": "example input value",
    // "output": "expected output for the given input"
    // Ensure the entire response is a valid JSON object.

    `;

    const generateProblem = async () => {
      setIsLoading(true);
      setOutput("Generating problem...");
      console.log("generating problem")
    
      // Clear previous states
      setProblem('');
      setHint('');
      setUserInput('');
      setExpectedOutput('');
      setProblemExplanation('');
      setSolutionSketch('');
      setShowProblemStatement(false);
      setShowHint(false);
      setShowProblemExplanation(false);
      setShowSolutionSketch(false);
    
      try {
        await callGeminiAPI(
          prompt,
          (data) => {
            
            try {
              const newdata = JSON.parse(data.slice(7, -4));
              console.log("Parsed response:", newdata);
    
              if (newdata.error) {
                console.log("Error in API response:", newdata.error);
                // Handle API error response - set the error message as output
                setOutput(newdata.error);
                console.log(newdata.error)
                
                // Reset all problem-related states
                setProblem('');
                setHint('');
                setUserInput('');
                setExpectedOutput('');
                setProblemExplanation('');
                setSolutionSketch('');
              } else {
                // Handle successful problem generation
                setProblem(newdata.problem);
                setHint(newdata.hint);
                setUserInput(newdata.input);
                setExpectedOutput(newdata.output);
                
                // Set success message and UI states
                setOutput('✅ Problem generated successfully! Now, try solving it!');
                console.log('✅ Problem generated successfully! Now, try solving it!');
                setCode(DEFAULT_CODE[language] || '');
                
                // Show relevant sections
                setShowProblemStatement(true);
                setShowHint(true);
              }
            } catch (parseError) {
              // Handle JSON parsing errors
              console.error("Failed to parse API response:", parseError);
              setOutput(`❌ Error: Failed to parse problem data. Please try again.`);
            }
          },
          '', // Empty success message (we handle it ourselves)
          ''  // Empty error message (we handle it ourselves)
        );
      } catch (apiError) {
        // Handle network/API call failures
        console.error("API call failed:", apiError);
        setOutput(`❌ Error: Failed to connect to the API. Please check your connection.`);
      } finally {
        setIsLoading(false);
      }
    };

  const explainProblem = async () => {
    if (!problem) {
      setOutput('Please generate a problem first to get an explanation!');
      console.log('Please generate a problem first to get an explanation!');
      return;
    }
    setIsLoading(true);
    setOutput('Generating explanation...');
    console.log('Generating explanation...');
    setProblemExplanation('');

    const prompt = `Given the coding problem: "${problem}". Explain it in simple terms, breaking down the requirements and suggesting a high-level approach. Focus on clarity and understanding, not directly on the solution code.`;

    const success = await callGeminiAPI(
      prompt,
      setProblemExplanation,
      'Problem explanation generated!',
      'Error generating explanation'
    );

    if (success) {
      setShowProblemExplanation(true);
    }
    setIsLoading(false);
  };

  const generateSolutionSketch = async () => {
    if (!problem) {
      setOutput('Please generate a problem first to get a solution sketch!');
      console.log('Please generate a problem first to get a solution sketch!');
      return;
    }
    setIsLoading(true);
    setOutput('Generating solution sketch...');
    console.log('Generating solution sketch...');
    setSolutionSketch('');

    const prompt = `Given the coding problem: "${problem}" and the hint: "${hint}", generate a detailed pseudocode or a high-level step-by-step solution sketch in ${language} for this problem. Do NOT provide the full implementation code, only the approach. Format the sketch clearly, possibly using bullet points or numbered steps.`;

    const success = await callGeminiAPI(
      prompt,
      setSolutionSketch,
      'Solution sketch generated!',
      'Error generating solution sketch'
    );

    if (success) {
      setShowSolutionSketch(true);
    }
    setIsLoading(false);
  };

  const runCode = async () => {
    if (!problem || !userInput || !expectedOutput) {
      setOutput('Please generate a problem with input and expected output first!');
      console.log('Please generate a problem with input and expected output first!');
      return;
    }
    
    setIsLoading(true);
    setOutput('Running your solution...');
    console.log('Running your solution...');
    
    try {
      let fullCode = code;
      if (language === 'javascript') {
        fullCode += `\nconsole.log(JSON.stringify(solve(${userInput})))`;
      } else if (language === 'python') {
        fullCode += `\nprint(solve(${userInput}))`;
      } else if (language === 'java') {
        fullCode += `\npublic class Main {\n  public static void main(String[] args) {\n    System.out.println(solve(${userInput}));\n  }\n}`;
      }

      const rapidApiKey = process.env.NEXT_PUBLIC_RAPIDAPI_KEY;

      const response = await axios.post(
        'https://judge0-ce.p.rapidapi.com/submissions',
        {
          source_code: fullCode,
          language_id: LANGUAGE_ID[language],
          stdin: '',
          expected_output: expectedOutput,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-RapidAPI-Key': rapidApiKey,
            'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
          },
        }
      );

      const token = response.data.token;
      let result;
      let attempts = 0;
      const maxAttempts = 15;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const resultResponse = await axios.get(
          `https://judge0-ce.p.rapidapi.com/submissions/${token}`,
          {
            headers: {
              'X-RapidAPI-Key': rapidApiKey,
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
      
      if (result.status && result.status.id === 3) {
        const actualOutput = (result.stdout || '').trim();
        const cleanedExpectedOutput = (expectedOutput || '').trim();
        const isCorrect = actualOutput === cleanedExpectedOutput;
        
        outputText = `Your output: ${actualOutput}\n\n`;
        outputText += `Expected output: ${cleanedExpectedOutput}\n\n`;
        outputText += isCorrect 
          ? '✅ Correct solution!'
          : '❌ Wrong answer. Try again!';
      } 
      else if (result.status && result.status.id === 6) {
        outputText = `Compilation Error:\n${result.compile_output || 'No specific compilation output.'}`;
      }
      else if (result.stderr) {
        outputText = `Runtime Error:\n${result.stderr}`;
      }
      else if (result.status) {
        outputText = `Execution Status: ${result.status.description}\n`;
        if (result.stdout) outputText += `Stdout:\n${result.stdout}\n`;
        if (result.stderr) outputText += `Stderr:\n${result.stderr}`;
      }
      else if (result.message) {
        outputText = result.message;
      }
      else {
        outputText = 'An unknown error occurred during code execution.';
      }

      setOutput(outputText);
    } catch (error) {
      console.error('Error executing code:', error);
      setOutput(`Error executing code: ${error.message || 'Check console for details.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white font-sans">
      {/* Top Bar: Controls */}
      <div className="p-4 bg-gray-800 flex flex-wrap justify-center sm:justify-between items-center shadow-md">
        <h1 className="text-2xl font-bold text-blue-400 mb-2 sm:mb-0 mr-4">Live IDE 2.0</h1>
        
        <div className="flex flex-wrap items-center space-x-2 sm:space-x-4 mb-2 sm:mb-0">
          {/* Language Selection */}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-gray-700 text-white p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
          </select>
          
          {/* Difficulty Selection */}
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="bg-gray-700 text-white p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>

          {/* Topic Input (via Modal Trigger) */}
          <div className="flex items-center">
            <input
              type="text"
              value={topic}
              readOnly
              className="bg-gray-700 text-white p-2 rounded-l w-32 focus:outline-none cursor-pointer text-sm"
              onClick={() => setShowTopicModal(true)}
              placeholder="Topic"
              title="Click to edit topic"
            />
            <button
              onClick={() => setShowTopicModal(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-r focus:outline-none focus:ring-2 focus:ring-blue-700 transition-colors duration-200"
              title="Edit Topic"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zm-5.414 7.071L7 13.586V15h1.414l3.586-3.586-2.828-2.828z"></path><path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-1.414l-1.414-1.414L10.586 11l-3.793-3.793-1.414-1.414-1.414-1.414L4 5zM4 7h4v4H4V7zm6.793 3.793l-2.828 2.828 2.828 2.828 2.828-2.828-2.828-2.828z" clipRule="evenodd"></path></svg>
            </button>
          </div>
          
          {/* Theme Selection */}
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="bg-gray-700 text-white p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="vs-dark">Dark Theme</option>
            <option value="light">Light Theme</option>
          </select>
        </div>
        
        {/* Action Buttons */}
        <div className="flex space-x-2 mt-2 sm:mt-0">
          <button
            onClick={generateProblem}
            disabled={isLoading}
            className={`px-4 py-2 rounded font-semibold transition-all duration-300 text-sm 
              ${isLoading ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}
            `}
          >
            {isLoading && output.includes('Generating') ? 'Generating...' : 'Generate Problem'}
          </button>
          <button
            onClick={runCode}
            disabled={isLoading || !problem}
            className={`px-4 py-2 rounded font-semibold transition-all duration-300 text-sm 
              ${isLoading && output.includes('Running') ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'} 
              ${!problem ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {isLoading && output.includes('Running') ? 'Running...' : 'Submit Solution'}
          </button>
        </div>
      </div>
      
      {/* Main Layout */}
      <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
        {/* Left Panel: Problem Details & LLM Features */}
        <div className="w-full md:w-3/5 p-4 overflow-auto bg-gray-800 border-b md:border-b-0 md:border-r border-gray-700">
          <h2 className="text-xl font-bold mb-3 text-green-300">Problem Overview</h2>
          {problem ? (
            <>
              {/* Problem Statement (Collapsible) */}
              <div className="mb-4 bg-gray-700 rounded-md border border-gray-600">
                <button
                  onClick={() => setShowProblemStatement(!showProblemStatement)}
                  className="w-full text-left p-3 flex justify-between items-center text-lg font-bold text-green-200 hover:bg-gray-600 rounded-t-md transition-colors duration-200"
                >
                  <span>Problem Statement:</span>
                  <span>{showProblemStatement ? '▲' : '▼'}</span>
                </button>
                {showProblemStatement && (
                  <div className="p-3 pt-0 text-sm">
                    <p className="whitespace-pre-wrap">{problem}</p>
                  </div>
                )}
              </div>

              {/* Hint (Collapsible) */}
              {hint && (
                <div className="mb-4 bg-gray-700 rounded-md border border-gray-600">
                  <button
                    onClick={() => setShowHint(!showHint)}
                    className="w-full text-left p-3 flex justify-between items-center text-lg font-bold text-yellow-200 hover:bg-gray-600 rounded-t-md transition-colors duration-200"
                >
                  <span>Hint:</span>
                  <span>{showHint ? '▲' : '▼'}</span>
                </button>
                {showHint && (
                  <div className="p-3 pt-0 text-sm">
                    <p className="whitespace-pre-wrap">{hint}</p>
                  </div>
                )}
              </div>
            )}

            {/* Input and Expected Output */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {userInput && (
                <div className="bg-gray-700 p-3 rounded-md border border-gray-600">
                  <h3 className="font-bold text-base text-purple-200 mb-2">Input:</h3>
                  <pre className="bg-gray-900 p-2 rounded-md overflow-x-auto text-xs max-h-32">{userInput}</pre>
                </div>
              )}
              {expectedOutput && (
                <div className="bg-gray-700 p-3 rounded-md border border-gray-600">
                  <h3 className="font-bold text-base text-teal-200 mb-2">Expected Output:</h3>
                  <pre className="bg-gray-900 p-2 rounded-md overflow-x-auto text-xs max-h-32">{expectedOutput}</pre>
                </div>
              )}
            </div>

            {/* LLM Feature Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 justify-center mt-4">
              <button
                onClick={explainProblem}
                disabled={isLoading || !problem}
                className={`flex-1 py-2 px-3 rounded-md font-semibold transition-all duration-300 text-sm 
                  ${isLoading || !problem ? 'bg-indigo-600 cursor-not-allowed opacity-75' : 'bg-indigo-500 hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-700'}
                `}
              >
                {isLoading && output.includes('explanation') ? 'Thinking...' : 'Explain Problem ✨'}
              </button>
              <button
                onClick={generateSolutionSketch}
                disabled={isLoading || !problem}
                className={`flex-1 py-2 px-3 rounded-md font-semibold transition-all duration-300 text-sm 
                  ${isLoading || !problem ? 'bg-fuchsia-600 cursor-not-allowed opacity-75' : 'bg-fuchsia-500 hover:bg-fuchsia-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-700'}
                `}
              >
                {isLoading && output.includes('sketch') ? 'Sketching...' : 'Generate Solution Sketch ✨'}
              </button>
            </div>

            {/* Problem Explanation (Collapsible) */}
            {problemExplanation && (
              <div className="mt-4 bg-gray-700 rounded-md border border-gray-600">
                <button
                  onClick={() => setShowProblemExplanation(!showProblemExplanation)}
                  className="w-full text-left p-3 flex justify-between items-center text-lg font-bold text-indigo-200 hover:bg-gray-600 rounded-t-md transition-colors duration-200"
                >
                  <span>Problem Explanation:</span>
                  <span>{showProblemExplanation ? '▲' : '▼'}</span>
                </button>
                {showProblemExplanation && (
                  <div className="p-3 pt-0 text-sm">
                    <p className="whitespace-pre-wrap">{problemExplanation}</p>
                  </div>
                )}
              </div>
            )}

            {/* Solution Sketch (Collapsible) */}
            {solutionSketch && (
              <div className="mt-4 bg-gray-700 rounded-md border border-gray-600">
                <button
                  onClick={() => setShowSolutionSketch(!showSolutionSketch)}
                  className="w-full text-left p-3 flex justify-between items-center text-lg font-bold text-fuchsia-200 hover:bg-gray-600 rounded-t-md transition-colors duration-200"
                >
                  <span>Solution Sketch / Pseudocode:</span>
                  <span>{showSolutionSketch ? '▲' : '▼'}</span>
                </button>
                {showSolutionSketch && (
                  <div className="p-3 pt-0 text-sm">
                    <pre className="whitespace-pre-wrap bg-gray-900 p-2 rounded-md overflow-x-auto">{solutionSketch}</pre>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="text-gray-400 text-center py-8">Generate a problem to get started!</div>
        )}
      </div>

      {/* Right Panel: Code Editor & Output Console */}
      <div className="w-full md:w-2/5 flex flex-col bg-gray-900">
        <div className="p-4 flex-grow flex flex-col" style={{ height: '50vh' }}>
          <h3 className="text-xl font-bold mb-3 text-cyan-300">Code Editor</h3>
          <div className="flex-grow overflow-hidden">
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
                scrollBeyondLastLine: false,
                automaticLayout: true,
                scrollbar: {
                  vertical: 'auto',
                  horizontal: 'auto',
                },
              }}
            />
          </div>
        </div>

        <div className="p-4 border-t border-gray-700">
          <h3 className="text-lg font-semibold mb-2 text-lime-300">Execution Output</h3>
          <pre 
            className={`whitespace-pre-wrap p-3 rounded text-sm font-mono min-h-32 max-h-48 overflow-auto 
              ${
                output.includes('Error') || output.includes('Wrong answer') || output.includes('Compilation Error') || output.includes('Runtime Error')
                  ? 'bg-red-900 text-red-100' 
                  : output.includes('Correct') 
                    ? 'bg-green-900 text-green-100'
                    : 'bg-gray-900 text-white'
              }`}
            style={{ maxHeight: '200px' }}
          >
            
            {output || 'if problem generated then Run your code to see output.\n if no problem is generated then there is no topic found relavant to the language selected'}
          </pre>
        </div>
      </div>
    </div>

      {/* Topic Input Modal */}
      {showTopicModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-6 rounded-lg shadow-2xl border border-gray-700 w-full max-w-sm">
            <h3 className="text-xl font-semibold text-blue-300 mb-4">Enter Topic</h3>
            <input
              type="text"
              value={tempTopic}
              onChange={(e) => setTempTopic(e.target.value)}
              className="shadow appearance-none border border-gray-700 rounded w-full py-2 px-3 bg-gray-700 text-gray-200 leading-tight focus:outline-none focus:shadow-outline focus:ring-2 focus:ring-blue-500 mb-4"
              placeholder="e.g., dynamic programming, sorting algorithms"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setTopic(tempTopic);
                  setShowTopicModal(false);
                }}
                className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors duration-200"
              >
                Set Topic
              </button>
              <button
                onClick={() => {
                  setTempTopic(topic);
                  setShowTopicModal(false);
                }}
                className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LiveIDEbyGem;