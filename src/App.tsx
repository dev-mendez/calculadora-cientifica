import { useState, useEffect, useRef } from 'react';
import { 
  Menu, 
  History as HistoryIcon, 
  Delete, 
  Minimize2, 
  Square, 
  X, 
  Trash2
} from 'lucide-react';

interface HistoryItem {
  expression: string;
  result: string;
  id: string;
}

export default function App() {
  // State
  const [currentVal, setCurrentVal] = useState<string>('0');
  const [expression, setExpression] = useState<string>('');
  const [memory, setMemory] = useState<number[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // Navigation / Side Panel
  const [activeTab, setActiveTab] = useState<'history' | 'memory'>('history');
  const [isSidePanelOpen, setIsSidePanelOpen] = useState<boolean>(true);

  // Helper state to track if we just calculated a result
  const [wasEvaluated, setWasEvaluated] = useState<boolean>(false);

  // Ref for adjusting font size on long values
  const valueDisplayRef = useRef<HTMLDivElement>(null);

  // Adjust display font size based on text length
  useEffect(() => {
    if (valueDisplayRef.current) {
      const len = currentVal.length;
      if (len > 16) {
        valueDisplayRef.current.style.fontSize = '20px';
      } else if (len > 12) {
        valueDisplayRef.current.style.fontSize = '28px';
      } else if (len > 8) {
        valueDisplayRef.current.style.fontSize = '36px';
      } else {
        valueDisplayRef.current.style.fontSize = '46px';
      }
    }
  }, [currentVal]);

  // Safe Math expression evaluator
  const evaluateExpression = (exprStr: string): number => {
    let sanitized = exprStr
      .replace(/×/g, '*')
      .replace(/÷/g, '/');

    try {
      // Safe parser helper
      const parseAndEval = (s: string): number => {
        let worked = s;
        
        // standard unary helper matches (like sqrt, sqr, inv)
        const replacer = (funcName: string, jsFunc: (v: number) => number) => {
          const regex = new RegExp(`${funcName}\\(([^()]+)\\)`, 'g');
          while (regex.test(worked)) {
            worked = worked.replace(regex, (_, inner) => {
              const innerVal = parseAndEval(inner);
              return jsFunc(innerVal).toString();
            });
          }
        };

        replacer('sqrt', Math.sqrt);
        replacer('sqr', (v) => Math.pow(v, 2));
        replacer('inv', (v) => 1 / v);

        return simpleEvaluate(worked);
      };

      return parseAndEval(sanitized);
    } catch (err) {
      throw new Error("Error de sintaxis");
    }
  };

  // Simple math expression parser for +, -, *, /, %
  const simpleEvaluate = (str: string): number => {
    let s = str.replace(/\s+/g, '');
    
    // Parse parentheses if any
    let openBr: number;
    while ((openBr = s.lastIndexOf('(')) !== -1) {
      const closeBr = s.indexOf(')', openBr);
      if (closeBr === -1) throw new Error("Paréntesis desbalanceados");
      const inner = s.slice(openBr + 1, closeBr);
      const res = simpleEvaluate(inner);
      s = s.slice(0, openBr) + (res >= 0 ? res.toString() : `(0${res})`) + s.slice(closeBr + 1);
    }

    // Tokenize
    const tokens: string[] = [];
    let currentToken = '';
    
    for (let i = 0; i < s.length; i++) {
      const char = s[i];
      if ('+-*/%'.includes(char)) {
        if (char === '-' && (i === 0 || '+-*/%'.includes(s[i - 1]))) {
          currentToken += char;
        } else {
          if (currentToken) {
            tokens.push(currentToken);
            currentToken = '';
          }
          tokens.push(char);
        }
      } else {
        currentToken += char;
      }
    }
    if (currentToken) {
      tokens.push(currentToken);
    }

    if (tokens.length === 0) return 0;

    // Helper to process operators
    const processOps = (ops: string[]) => {
      let idx = 0;
      while (idx < tokens.length) {
        const token = tokens[idx];
        if (ops.includes(token)) {
          const left = parseFloat(tokens[idx - 1]);
          const right = parseFloat(tokens[idx + 1]);
          let res = 0;
          if (token === '*') res = left * right;
          if (token === '/') {
            if (right === 0) throw new Error("No se puede dividir por cero");
            res = left / right;
          }
          if (token === '%') res = left % right;
          if (token === '+') res = left + right;
          if (token === '-') res = left - right;
          
          tokens.splice(idx - 1, 3, res.toString());
          idx--;
        } else {
          idx++;
        }
      }
    };

    // Operator precedence: *, /, % first, then +, -
    processOps(['*', '/', '%']);
    processOps(['+', '-']);

    return parseFloat(tokens[0]);
  };

  // Format result output
  const formatResult = (num: number): string => {
    if (isNaN(num)) return 'Entrada no válida';
    if (!isFinite(num)) return 'Desbordamiento';
    
    const strVal = num.toString();
    if (strVal.includes('.') && strVal.length > 12) {
      return parseFloat(num.toFixed(10)).toString();
    }
    return strVal;
  };

  // Button clicks dispatcher
  const handleNumClick = (val: string) => {
    if (wasEvaluated) {
      setCurrentVal(val);
      setWasEvaluated(false);
    } else {
      if (currentVal === '0') {
        setCurrentVal(val);
      } else {
        setCurrentVal(currentVal + val);
      }
    }
  };

  const handleDecimal = () => {
    if (wasEvaluated) {
      setCurrentVal('0.');
      setWasEvaluated(false);
    } else {
      if (!currentVal.includes('.')) {
        setCurrentVal(currentVal + '.');
      }
    }
  };

  const handleBackspace = () => {
    if (wasEvaluated) {
      setExpression('');
      setWasEvaluated(false);
    } else {
      if (currentVal.length > 1) {
        setCurrentVal(currentVal.slice(0, -1));
      } else {
        setCurrentVal('0');
      }
    }
  };

  const handleClear = () => {
    setCurrentVal('0');
    setExpression('');
    setWasEvaluated(false);
  };

  const handleClearEntry = () => {
    setCurrentVal('0');
  };

  const handleToggleSign = () => {
    if (currentVal !== '0') {
      if (currentVal.startsWith('-')) {
        setCurrentVal(currentVal.slice(1));
      } else {
        setCurrentVal('-' + currentVal);
      }
    }
  };

  // Binary operators: +, -, *, /
  const handleBinaryOp = (op: string) => {
    let visualOp = op;
    if (op === '*') visualOp = '×';
    if (op === '/') visualOp = '÷';

    if (wasEvaluated) {
      setExpression(`${currentVal} ${visualOp} `);
      setWasEvaluated(false);
    } else {
      setExpression(`${expression}${currentVal} ${visualOp} `);
    }
    setCurrentVal('0');
  };

  // Percentage logic standard calculator style
  const handlePercentage = () => {
    const match = expression.trim().match(/([0-9.-]+)\s*([+×÷\-*/])\s*$/);
    const inputVal = parseFloat(currentVal);
    if (match && !isNaN(inputVal)) {
      const baseVal = parseFloat(match[1]);
      const op = match[2];
      let percentVal = 0;
      if (op === '+' || op === '-') {
        percentVal = (baseVal * inputVal) / 100;
      } else {
        percentVal = inputVal / 100;
      }
      setCurrentVal(formatResult(percentVal));
    } else {
      const val = parseFloat(currentVal);
      if (!isNaN(val)) {
        setCurrentVal(formatResult(val / 100));
      }
    }
  };

  // Immediate Unary functions: reciprocal (1/x), square (x^2), square root (sqrt)
  const handleUnaryOp = (funcName: string) => {
    let resolvedFuncName = funcName;
    let resultExpr = '';
    let resultVal = 0;
    const inputVal = evaluateExpression(currentVal);

    switch (resolvedFuncName) {
      case 'sqr':
        resultExpr = `sqr(${currentVal})`;
        resultVal = Math.pow(inputVal, 2);
        break;
      case 'inv':
        resultExpr = `1/(${currentVal})`;
        resultVal = 1 / inputVal;
        break;
      case 'sqrt':
        resultExpr = `√(${currentVal})`;
        resultVal = Math.sqrt(inputVal);
        break;
      default:
        return;
    }

    setExpression(expression + resultExpr);
    setCurrentVal(formatResult(resultVal));
    setWasEvaluated(false);
  };

  // Evaluate final result (=)
  const handleEquals = () => {
    let fullExpr = expression + currentVal;
    
    // Auto-close open parenthesis
    const openParensCount = (fullExpr.match(/\(/g) || []).length;
    const closeParensCount = (fullExpr.match(/\)/g) || []).length;
    if (openParensCount > closeParensCount) {
      fullExpr += ')'.repeat(openParensCount - closeParensCount);
    }

    try {
      const result = evaluateExpression(fullExpr);
      const formatted = formatResult(result);
      
      // Update history
      const newHistoryItem: HistoryItem = {
        expression: fullExpr,
        result: formatted,
        id: Math.random().toString(36).substr(2, 9)
      };
      setHistory([newHistoryItem, ...history]);
      
      setCurrentVal(formatted);
      setExpression('');
      setWasEvaluated(true);
    } catch (err: any) {
      setCurrentVal(err.message || 'Error');
      setWasEvaluated(true);
    }
  };

  // Memory Actions
  const handleMemoryStore = () => {
    const val = evaluateExpression(currentVal);
    if (!isNaN(val)) {
      setMemory([val, ...memory]);
    }
  };

  const handleMemoryRecall = () => {
    if (memory.length > 0) {
      setCurrentVal(formatResult(memory[0]));
    }
  };

  const handleMemoryAdd = () => {
    if (memory.length > 0) {
      const current = evaluateExpression(currentVal);
      const updated = [...memory];
      updated[0] = (updated[0] || 0) + current;
      setMemory(updated);
    } else {
      handleMemoryStore();
    }
  };

  const handleMemorySubtract = () => {
    if (memory.length > 0) {
      const current = evaluateExpression(currentVal);
      const updated = [...memory];
      updated[0] = (updated[0] || 0) - current;
      setMemory(updated);
    } else {
      const val = evaluateExpression(currentVal);
      if (!isNaN(val)) {
        setMemory([-val]);
      }
    }
  };

  const handleMemoryClear = () => {
    setMemory([]);
  };

  const clearHistory = () => {
    setHistory([]);
  };

  return (
    <div className="win11-window">
      {/* OS Mock Titlebar */}
      <div className="titlebar">
        <div className="titlebar-left">
          <img 
            src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%239c27b0'><rect width='24' height='24' rx='4'/><path d='M7 6h10v2H7zm0 4h10v2H7zm0 4h10v2H7z' fill='white'/></svg>" 
            alt="App Icon" 
            className="titlebar-icon"
          />
          <span>Calculadora</span>
        </div>
        <div className="titlebar-controls">
          <button className="titlebar-btn"><Minimize2 size={12} /></button>
          <button className="titlebar-btn"><Square size={10} /></button>
          <button className="titlebar-btn close"><X size={14} /></button>
        </div>
      </div>

      <div className="calculator-workspace">
        {/* Left Side: Calculator Panel */}
        <div className="calculator-main">
          {/* Menu / Toolbar */}
          <div className="calc-header">
            <div className="calc-header-left">
              <button className="menu-btn" aria-label="Menú">
                <Menu size={20} />
              </button>
              <h1 className="calc-title">Estándar</h1>
            </div>
            <button 
              className="history-toggle-btn"
              onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
              aria-label="Historial"
            >
              <HistoryIcon size={18} />
            </button>
          </div>

          {/* Screen */}
          <div className="calc-display">
            <div className="expression-display">{expression}</div>
            <div className="value-display" ref={valueDisplayRef}>{currentVal}</div>
          </div>

          {/* Memory Bar */}
          <div className="memory-bar">
            <button className="memory-btn" onClick={handleMemoryClear} disabled={memory.length === 0}>MC</button>
            <button className="memory-btn" onClick={handleMemoryRecall} disabled={memory.length === 0}>MR</button>
            <button className="memory-btn" onClick={handleMemoryAdd}>M+</button>
            <button className="memory-btn" onClick={handleMemorySubtract}>M-</button>
            <button className="memory-btn" onClick={handleMemoryStore}>MS</button>
            <button className="memory-btn" onClick={() => {
              setActiveTab('memory');
              setIsSidePanelOpen(true);
            }} disabled={memory.length === 0}>Mv</button>
          </div>

          {/* Button Grid (4x6) */}
          <div className="button-grid">
            {/* Row 1 */}
            <button className="calc-btn" onClick={handlePercentage}>%</button>
            <button className="calc-btn" onClick={handleClearEntry}>CE</button>
            <button className="calc-btn" onClick={handleClear}>C</button>
            <button className="calc-btn" onClick={handleBackspace} aria-label="Borrar">
              <Delete size={16} />
            </button>

            {/* Row 2 */}
            <button className="calc-btn" onClick={() => handleUnaryOp('inv')}>1/x</button>
            <button className="calc-btn" onClick={() => handleUnaryOp('sqr')}>x²</button>
            <button className="calc-btn" onClick={() => handleUnaryOp('sqrt')}>²√x</button>
            <button className="calc-btn" onClick={() => handleBinaryOp('/')}>÷</button>

            {/* Row 3 */}
            <button className="calc-btn number" onClick={() => handleNumClick('7')}>7</button>
            <button className="calc-btn number" onClick={() => handleNumClick('8')}>8</button>
            <button className="calc-btn number" onClick={() => handleNumClick('9')}>9</button>
            <button className="calc-btn" onClick={() => handleBinaryOp('*')}>×</button>

            {/* Row 4 */}
            <button className="calc-btn number" onClick={() => handleNumClick('4')}>4</button>
            <button className="calc-btn number" onClick={() => handleNumClick('5')}>5</button>
            <button className="calc-btn number" onClick={() => handleNumClick('6')}>6</button>
            <button className="calc-btn" onClick={() => handleBinaryOp('-')}>-</button>

            {/* Row 5 */}
            <button className="calc-btn number" onClick={() => handleNumClick('1')}>1</button>
            <button className="calc-btn number" onClick={() => handleNumClick('2')}>2</button>
            <button className="calc-btn number" onClick={() => handleNumClick('3')}>3</button>
            <button className="calc-btn" onClick={() => handleBinaryOp('+')}>+</button>

            {/* Row 6 */}
            <button className="calc-btn number" onClick={handleToggleSign}>+/-</button>
            <button className="calc-btn number" onClick={() => handleNumClick('0')}>0</button>
            <button className="calc-btn number" onClick={handleDecimal}>,</button>
            <button className="calc-btn equal" onClick={handleEquals}>=</button>
          </div>
        </div>

        {/* Right Side: History / Memory Side Panel */}
        {isSidePanelOpen && (
          <div className={`side-panel ${isSidePanelOpen ? 'open' : ''}`}>
            <div className="side-panel-header">
              <span 
                className={`side-panel-tab ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => setActiveTab('history')}
              >
                Historial
              </span>
              <span 
                className={`side-panel-tab ${activeTab === 'memory' ? 'active' : ''}`}
                onClick={() => setActiveTab('memory')}
              >
                Memoria
              </span>
            </div>
            
            <div className="side-panel-content">
              {activeTab === 'history' ? (
                history.length === 0 ? (
                  <div className="empty-panel-text">Aún no hay historial</div>
                ) : (
                  history.map((item) => (
                    <div 
                      key={item.id} 
                      className="history-item"
                      onClick={() => {
                        setExpression(item.expression);
                        setCurrentVal(item.result);
                        setWasEvaluated(true);
                      }}
                    >
                      <span className="history-item-expr">{item.expression} =</span>
                      <span className="history-item-val">{item.result}</span>
                    </div>
                  ))
                )
              ) : (
                memory.length === 0 ? (
                  <div className="empty-panel-text">No hay nada guardado en la memoria</div>
                ) : (
                  memory.map((val, idx) => (
                    <div key={idx} className="memory-list-item">
                      <span className="memory-list-val">{formatResult(val)}</span>
                      <div className="memory-list-actions">
                        <button 
                          className="mem-action-btn"
                          onClick={() => {
                            const updated = [...memory];
                            updated.splice(idx, 1);
                            setMemory(updated);
                          }}
                        >
                          MC
                        </button>
                        <button 
                          className="mem-action-btn"
                          onClick={() => {
                            const updated = [...memory];
                            updated[idx] = updated[idx] + evaluateExpression(currentVal);
                            setMemory(updated);
                          }}
                        >
                          M+
                        </button>
                        <button 
                          className="mem-action-btn"
                          onClick={() => {
                            const updated = [...memory];
                            updated[idx] = updated[idx] - evaluateExpression(currentVal);
                            setMemory(updated);
                          }}
                        >
                          M-
                        </button>
                      </div>
                    </div>
                  ))
                )
              )}
            </div>

            {((activeTab === 'history' && history.length > 0) || (activeTab === 'memory' && memory.length > 0)) && (
              <button 
                className="clear-panel-btn" 
                onClick={activeTab === 'history' ? clearHistory : handleMemoryClear}
              >
                <Trash2 size={14} />
                <span>Borrar todo</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
