import { useState, useRef, useEffect } from 'react';
import { motion} from 'framer-motion';
import { useUser } from '../context/useUser';
import './Chat.css';

export default function Chat() {
  const { api } = useUser();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const { data } = await api.post('/chat/message', {
        message: userMessage,
        sessionId
      });

      setSessionId(data.sessionId);
      setMessages(prev => [...prev, { role: 'mirror', content: data.response }]);
    } catch {
      setMessages(prev => [...prev, { 
        role: 'mirror', 
        content: "I'm here. Sometimes presence is enough." 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="chat page-container">
      <div className="chat-header">
        <h2 className="chat-title">Mirror</h2>
        <p className="mono chat-hint">reflections, not advice</p>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <motion.div 
            className="chat-empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            <p className="chat-empty-text">
              Say what's on your mind.<br />
              <span className="chat-empty-sub">Or say nothing at all.</span>
            </p>
          </motion.div>
        )}

        {messages.map((msg, i) => (
          <motion.div
            key={i}
            className={`chat-bubble ${msg.role}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {msg.role === 'mirror' && (
              <span className="chat-mirror-label mono">mirror</span>
            )}
            <p className="chat-bubble-text">{msg.content}</p>
          </motion.div>
        ))}

        {loading && (
          <motion.div 
            className="chat-bubble mirror"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <span className="chat-mirror-label mono">mirror</span>
            <div className="chat-typing">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <textarea
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="speak..."
          rows={1}
          disabled={loading}
        />
        <button 
          className="chat-send"
          onClick={sendMessage}
          disabled={!input.trim() || loading}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
