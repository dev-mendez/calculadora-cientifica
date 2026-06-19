import { useState, useEffect, useRef } from 'react';
import { 
  Menu, 
  History as HistoryIcon, 
  Delete, 
  Minimize2, 
  Square, 
  X, 
  ChevronDown, 
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
  
  const [isDeg, setIsDeg] = useState<boolean>(true);
  const [isFE, setIsFE] = useState<boolean>(false);
  const [isSecond, setIsSecond] = useState<boolean>(false);
  
  // Navigation / Side Panel
  const [activeTab, setActiveTab] = useState<'history' | 'memory'>('history');
  const [isSidePanelOpen, setIsSidePanelOpen] = useState<boolean>(true);
  const [showTrigDropdown, setShowTrigDropdown] = useState<boolean>(false);
  const [showFuncDropdown, setShowFuncDropdown] = useState<boolean>(false);

  // Helper state to track if we just calculated a result
  const [wasEvaluated, setWasEvaluated] = useState<boolean>(false);

  // Ref for adjusting font size on long values
  const valueDisplayRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = () => {
      setShowTrigDropdown(false);
      setShowFuncDropdown(false);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

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

  // Factorial helper
  const factorial = (n: number): number => {
    if (n < 0) return NaN;
    if (n === 0 || n === 1) return 1;
    if (!Number.isInteger(n)) {
      // Gamma function approximation for non-integers (Lanczos approximation)
      return LanczosGamma(n + 1);
    }
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
  };

  const LanczosGamma = (z: number): number => {
    const p = [
      0.99999999999980993, 676.5203681218851, -1259.1392167224028,
      771.32342877765313, -176.61502916214059, 12.507343278686905,
      -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
    ];
    if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * LanczosGamma(1 - z));
    z -= 1;
    let x = p[0];
    for (let i = 1; i < 9; i++) x += p[i] / (z + i);
    const t = z + 7.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
  };

  // Safe Math expression evaluator
  const evaluateExpression = (exprStr: string): number => {
    // Replace visual operators with math operators
    let sanitized = exprStr
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/π/g, Math.PI.toString())
      .replace(/\be\b/g, Math.E.toString());

    // Evaluate basic math safely without eval() using custom shunting yard or simple safe Function evaluation
    // Since this is a client-side calculator expression with sanitized tokens:
    try {
      
      // Map functions to Math.*
      // Make sure angles are handled if DEG mode is active
      const degToRad = (val: number) => isDeg ? (val * Math.PI) / 180 : val;
      const radToDeg = (val: number) => isDeg ? (val * 180) / Math.PI : val;

      // Safe parser helper
      const parseAndEval = (s: string): number => {
        // Pre-processing functions
        // E.g., sin(30) -> Math.sin(degToRad(30))
        // We will match function patterns and recursively evaluate their inner arguments
        
        let worked = s;
        
        // Custom replacer for functions
        const replacer = (funcName: string, jsFunc: (v: number) => number) => {
          const regex = new RegExp(`${funcName}\\(([^()]+)\\)`, 'g');
          while (regex.test(worked)) {
            worked = worked.replace(regex, (_, inner) => {
              const innerVal = parseAndEval(inner);
              return jsFunc(innerVal).toString();
            });
          }
        };

        // Standard trig
        replacer('sin', (v) => Math.sin(degToRad(v)));
        replacer('cos', (v) => Math.cos(degToRad(v)));
        replacer('tan', (v) => Math.tan(degToRad(v)));
        replacer('asin', (v) => radToDeg(Math.asin(v)));
        replacer('acos', (v) => radToDeg(Math.acos(v)));
        replacer('atan', (v) => radToDeg(Math.atan(v)));
        
        // Hyperbolic
        replacer('sinh', Math.sinh);
        replacer('cosh', Math.cosh);
        replacer('tanh', Math.tanh);

        // Logs and Roots
        replacer('ln', Math.log);
        replacer('log', Math.log10);
        replacer('sqrt', Math.sqrt);
        replacer('cbrt', Math.cbrt);
        replacer('abs', Math.abs);
        replacer('floor', Math.floor);
        replacer('ceil', Math.ceil);
        replacer('fact', factorial);

        // Power functions like pow(x, y)
        const powRegex = /pow\(([^,()]+),([^,()]+)\)/g;
        while (powRegex.test(worked)) {
          worked = worked.replace(powRegex, (_, x, y) => {
            const valX = parseAndEval(x);
            const valY = parseAndEval(y);
            return Math.pow(valX, valY).toString();
          });
        }

        // Roots functions like root(x, y) -> y-th root of x
        const rootRegex = /root\(([^,()]+),([^,()]+)\)/g;
        while (rootRegex.test(worked)) {
          worked = worked.replace(rootRegex, (_, x, y) => {
            const valX = parseAndEval(x);
            const valY = parseAndEval(y);
            return Math.pow(valX, 1 / valY).toString();
          });
        }

        // Safe basic arithmetic evaluator (shunting-yard token parse)
        return simpleEvaluate(worked);
      };

      return parseAndEval(sanitized);
    } catch (err) {
      throw new Error("Error de sintaxis");
    }
  };

  // Simple math expression parser for +, -, *, /, %, unary minus, brackets
  const simpleEvaluate = (str: string): number => {
    // Clean string
    let s = str.replace(/\s+/g, '');
    
    // Parse parentheses by recursion
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
        // Handle negative numbers or signs at the beginning or after another operator
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

  // Format result output (e.g. F-E, decimal precision)
  const formatResult = (num: number): string => {
    if (isNaN(num)) return 'Entrada no válida';
    if (!isFinite(num)) return 'Desbordamiento';
    
    if (isFE) {
      return num.toExponential(6);
    }
    
    // Prevent long floating point inaccuracies e.g. 0.1 + 0.2 = 0.30000000000000004
    const strVal = num.toString();
    if (strVal.includes('.') && strVal.length > 12) {
      // limit decimal places to prevent float precision errors
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

  const handleToggleSign = () => {
    if (currentVal !== '0') {
      if (currentVal.startsWith('-')) {
        setCurrentVal(currentVal.slice(1));
      } else {
        setCurrentVal('-' + currentVal);
      }
    }
  };

  // Binary operators: +, -, *, /, mod
  const handleBinaryOp = (op: string) => {
    let visualOp = op;
    if (op === '*') visualOp = '×';
    if (op === '/') visualOp = '÷';
    if (op === '%') visualOp = ' mod ';

    if (wasEvaluated) {
      setExpression(`${currentVal} ${visualOp} `);
      setWasEvaluated(false);
    } else {
      setExpression(`${expression}${currentVal} ${visualOp} `);
    }
    setCurrentVal('0');
  };

  // Power binary operator (x^y or y-th root of x)
  const handlePowerOp = () => {
    const isRoot = isSecond;
    if (wasEvaluated) {
      setExpression(isRoot ? `root(${currentVal}, ` : `pow(${currentVal}, `);
      setWasEvaluated(false);
    } else {
      setExpression(`${expression}${isRoot ? 'root(' : 'pow('}${currentVal}, `);
    }
    setCurrentVal('0');
  };

  // Parentheses
  const handleParenthesis = (paren: string) => {
    if (wasEvaluated) {
      setExpression(paren);
      setWasEvaluated(false);
    } else {
      setExpression(expression + paren);
    }
  };

  // Constant inputs
  const handleConstant = (name: string) => {
    const val = name === 'pi' ? 'π' : 'e';
    if (wasEvaluated) {
      setCurrentVal(val);
      setWasEvaluated(false);
    } else {
      setCurrentVal(val);
    }
  };

  // Immediate Unary functions: sin, cos, tan, log, ln, sqrt, sqr, 1/x, abs, fact, 10^x
  const handleUnaryOp = (funcName: string) => {
    let resolvedFuncName = funcName;
    
    // Handle 2nd toggles
    if (isSecond) {
      if (funcName === 'sqr') resolvedFuncName = 'cube';
      else if (funcName === 'sqrt') resolvedFuncName = 'cbrt';
      else if (funcName === 'pow10') resolvedFuncName = 'pow2';
      else if (funcName === 'ln') resolvedFuncName = 'exp';
    }

    let resultExpr = '';
    let resultVal = 0;
    const inputVal = evaluateExpression(currentVal);

    switch (resolvedFuncName) {
      case 'sqr':
        resultExpr = `sqr(${currentVal})`;
        resultVal = Math.pow(inputVal, 2);
        break;
      case 'cube':
        resultExpr = `cube(${currentVal})`;
        resultVal = Math.pow(inputVal, 3);
        break;
      case 'inv':
        resultExpr = `1/(${currentVal})`;
        resultVal = 1 / inputVal;
        break;
      case 'abs':
        resultExpr = `abs(${currentVal})`;
        resultVal = Math.abs(inputVal);
        break;
      case 'sqrt':
        resultExpr = `√(${currentVal})`;
        resultVal = Math.sqrt(inputVal);
        break;
      case 'cbrt':
        resultExpr = `³√(${currentVal})`;
        resultVal = Math.cbrt(inputVal);
        break;
      case 'pow10':
        resultExpr = `10^(${currentVal})`;
        resultVal = Math.pow(10, inputVal);
        break;
      case 'pow2':
        resultExpr = `2^(${currentVal})`;
        resultVal = Math.pow(2, inputVal);
        break;
      case 'log':
        resultExpr = `log(${currentVal})`;
        resultVal = Math.log10(inputVal);
        break;
      case 'ln':
        resultExpr = `ln(${currentVal})`;
        resultVal = Math.log(inputVal);
        break;
      case 'exp':
        resultExpr = `e^(${currentVal})`;
        resultVal = Math.exp(inputVal);
        break;
      case 'fact':
        resultExpr = `fact(${currentVal})`;
        resultVal = factorial(inputVal);
        break;
      case 'sin':
      case 'cos':
      case 'tan':
      case 'sinh':
      case 'cosh':
      case 'tanh':
      case 'asin':
      case 'acos':
      case 'atan':
      case 'floor':
      case 'ceil':
        resultExpr = `${resolvedFuncName}(${currentVal})`;
        // Trig is handled internally inside evaluateExpression
        resultVal = evaluateExpression(`${resolvedFuncName}(${currentVal})`);
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
    
    // Auto-close open parenthesis or pow/root brackets
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
            src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23689f38'><rect width='24' height='24' rx='4'/><path d='M7 6h10v2H7zm0 4h10v2H7zm0 4h10v2H7z' fill='white'/></svg>" 
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
              <h1 className="calc-title">Científica</h1>
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

          {/* Toggles (DEG/RAD, F-E) */}
          <div className="calc-toggles">
            <span 
              className={`toggle-item ${isDeg ? 'active' : ''}`}
              onClick={() => setIsDeg(true)}
            >
              DEG
            </span>
            <span 
              className={`toggle-item ${!isDeg ? 'active' : ''}`}
              onClick={() => setIsDeg(false)}
            >
              RAD
            </span>
            <span 
              className={`toggle-item ${isFE ? 'active' : ''}`}
              onClick={() => setIsFE(!isFE)}
            >
              F-E
            </span>
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

          {/* Trigonometry & Function Dropdowns */}
          <div className="dropdown-row">
            <div className="dropdown-container">
              <button 
                className="dropdown-trigger"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTrigDropdown(!showTrigDropdown);
                  setShowFuncDropdown(false);
                }}
              >
                <span>⊿ Trigonometría</span>
                <ChevronDown size={12} />
              </button>
              {showTrigDropdown && (
                <div className="dropdown-menu" onClick={(e) => e.stopPropagation()}>
                  <button className="dropdown-item" onClick={() => { handleUnaryOp('sin'); setShowTrigDropdown(false); }}>sin</button>
                  <button className="dropdown-item" onClick={() => { handleUnaryOp('cos'); setShowTrigDropdown(false); }}>cos</button>
                  <button className="dropdown-item" onClick={() => { handleUnaryOp('tan'); setShowTrigDropdown(false); }}>tan</button>
                  <button className="dropdown-item" onClick={() => { handleUnaryOp('asin'); setShowTrigDropdown(false); }}>sin⁻¹</button>
                  <button className="dropdown-item" onClick={() => { handleUnaryOp('acos'); setShowTrigDropdown(false); }}>cos⁻¹</button>
                  <button className="dropdown-item" onClick={() => { handleUnaryOp('atan'); setShowTrigDropdown(false); }}>tan⁻¹</button>
                  <button className="dropdown-item" onClick={() => { handleUnaryOp('sinh'); setShowTrigDropdown(false); }}>sinh</button>
                  <button className="dropdown-item" onClick={() => { handleUnaryOp('cosh'); setShowTrigDropdown(false); }}>cosh</button>
                  <button className="dropdown-item" onClick={() => { handleUnaryOp('tanh'); setShowTrigDropdown(false); }}>tanh</button>
                </div>
              )}
            </div>

            <div className="dropdown-container">
              <button 
                className="dropdown-trigger"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFuncDropdown(!showFuncDropdown);
                  setShowTrigDropdown(false);
                }}
              >
                <span>ƒ Función</span>
                <ChevronDown size={12} />
              </button>
              {showFuncDropdown && (
                <div className="dropdown-menu" onClick={(e) => e.stopPropagation()}>
                  <button className="dropdown-item" onClick={() => { handleUnaryOp('abs'); setShowFuncDropdown(false); }}>|x|</button>
                  <button className="dropdown-item" onClick={() => { handleUnaryOp('floor'); setShowFuncDropdown(false); }}>floor</button>
                  <button className="dropdown-item" onClick={() => { handleUnaryOp('ceil'); setShowFuncDropdown(false); }}>ceil</button>
                  <button className="dropdown-item" onClick={() => { 
                    setCurrentVal(formatResult(Math.random())); 
                    setShowFuncDropdown(false); 
                  }}>rand</button>
                </div>
              )}
            </div>
          </div>

          {/* Button Grid (5x7) */}
          <div className="button-grid">
            {/* Row 1 */}
            <button className={`calc-btn ${isSecond ? 'equal' : ''}`} onClick={() => setIsSecond(!isSecond)}>
              2nd
            </button>
            <button className="calc-btn" onClick={() => handleConstant('pi')}>π</button>
            <button className="calc-btn" onClick={() => handleConstant('e')}>e</button>
            <button className="calc-btn" onClick={handleClear}>C</button>
            <button className="calc-btn" onClick={handleBackspace} aria-label="Retroceso">
              <Delete size={16} />
            </button>

            {/* Row 2 */}
            <button className="calc-btn" onClick={() => handleUnaryOp('sqr')}>
              {isSecond ? <span>x³</span> : <span>x²</span>}
            </button>
            <button className="calc-btn" onClick={() => handleUnaryOp('inv')}>1/x</button>
            <button className="calc-btn" onClick={() => handleUnaryOp('abs')}>|x|</button>
            <button className="calc-btn" onClick={() => handleNumClick('e+')}>exp</button>
            <button className="calc-btn" onClick={() => handleBinaryOp('%')}>mod</button>

            {/* Row 3 */}
            <button className="calc-btn" onClick={() => handleUnaryOp('sqrt')}>
              {isSecond ? <span>³√x</span> : <span>²√x</span>}
            </button>
            <button className="calc-btn" onClick={() => handleParenthesis('(')}>(</button>
            <button className="calc-btn" onClick={() => handleParenthesis(')')}>)</button>
            <button className="calc-btn" onClick={() => handleUnaryOp('fact')}>n!</button>
            <button className="calc-btn" onClick={() => handleBinaryOp('/')}>÷</button>

            {/* Row 4 */}
            <button className="calc-btn" onClick={handlePowerOp}>
              {isSecond ? <span><sup>y</sup>√x</span> : <span>x<sup>y</sup></span>}
            </button>
            <button className="calc-btn number" onClick={() => handleNumClick('7')}>7</button>
            <button className="calc-btn number" onClick={() => handleNumClick('8')}>8</button>
            <button className="calc-btn number" onClick={() => handleNumClick('9')}>9</button>
            <button className="calc-btn" onClick={() => handleBinaryOp('*')}>×</button>

            {/* Row 5 */}
            <button className="calc-btn" onClick={() => handleUnaryOp('pow10')}>
              {isSecond ? <span>2<sup>x</sup></span> : <span>10<sup>x</sup></span>}
            </button>
            <button className="calc-btn number" onClick={() => handleNumClick('4')}>4</button>
            <button className="calc-btn number" onClick={() => handleNumClick('5')}>5</button>
            <button className="calc-btn number" onClick={() => handleNumClick('6')}>6</button>
            <button className="calc-btn" onClick={() => handleBinaryOp('-')}>-</button>

            {/* Row 6 */}
            <button className="calc-btn" onClick={() => handleUnaryOp('log')}>log</button>
            <button className="calc-btn number" onClick={() => handleNumClick('1')}>1</button>
            <button className="calc-btn number" onClick={() => handleNumClick('2')}>2</button>
            <button className="calc-btn number" onClick={() => handleNumClick('3')}>3</button>
            <button className="calc-btn" onClick={() => handleBinaryOp('+')}>+</button>

            {/* Row 7 */}
            <button className="calc-btn" onClick={() => handleUnaryOp('ln')}>
              {isSecond ? <span>e<sup>x</sup></span> : <span>ln</span>}
            </button>
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
