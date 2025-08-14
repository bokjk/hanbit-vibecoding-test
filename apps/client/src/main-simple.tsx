import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./reset.css";
import "./index.css";

// 간단한 테스트 컴포넌트
function SimpleApp() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f3f4f6', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center' 
    }}>
      <div style={{ 
        backgroundColor: 'white', 
        padding: '2rem', 
        borderRadius: '0.5rem', 
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' 
      }}>
        <h1 style={{ 
          fontSize: '1.5rem', 
          lineHeight: '2rem', 
          fontWeight: 'bold', 
          color: '#1f2937', 
          marginBottom: '1rem' 
        }}>
          🎉 TODO 앱 테스트
        </h1>
        <p style={{ color: '#4b5563' }}>
          이 메시지가 보인다면 기본 React 앱이 정상 동작합니다!
        </p>
        <button 
          style={{ 
            marginTop: '1rem', 
            paddingLeft: '1rem', 
            paddingRight: '1rem', 
            paddingTop: '0.5rem', 
            paddingBottom: '0.5rem', 
            backgroundColor: '#3b82f6', 
            color: 'white', 
            borderRadius: '0.25rem', 
            border: 'none',
            cursor: 'pointer',
            transition: 'background-color 200ms ease' 
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
          onClick={() => alert('버튼 클릭됨!')}
        >
          테스트 버튼
        </button>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SimpleApp />
  </StrictMode>,
);