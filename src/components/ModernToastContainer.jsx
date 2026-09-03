import React, { useState, useEffect } from 'react';
import { toast } from '../utils/toast';

export default function ModernToastContainer() {
  const [toasts, setToasts] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);

  useEffect(() => {
    const unsubToast = toast.subscribe((newToast) => {
      setToasts((prev) => [...prev, newToast]);

      // Auto dismiss
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, newToast.duration || 4000);
    });

    const unsubConfirm = toast.subscribeConfirm((config) => {
      setConfirmDialog(config);
    });

    return () => {
      unsubToast();
      unsubConfirm();
    };
  }, []);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const getToastIcon = (type) => {
    switch (type) {
      case 'success':
        return 'fa-circle-check';
      case 'error':
        return 'fa-circle-xmark';
      case 'warning':
        return 'fa-triangle-exclamation';
      case 'info':
      default:
        return 'fa-circle-info';
    }
  };

  const getToastColors = (type) => {
    switch (type) {
      case 'success':
        return {
          border: '#10b981',
          bg: 'rgba(255, 255, 255, 0.98)',
          iconColor: '#10b981',
          glow: 'rgba(16, 185, 129, 0.25)',
          bar: '#10b981'
        };
      case 'error':
        return {
          border: '#ef4444',
          bg: 'rgba(255, 255, 255, 0.98)',
          iconColor: '#ef4444',
          glow: 'rgba(239, 68, 68, 0.25)',
          bar: '#ef4444'
        };
      case 'warning':
        return {
          border: '#f59e0b',
          bg: 'rgba(255, 255, 255, 0.98)',
          iconColor: '#f59e0b',
          glow: 'rgba(245, 158, 11, 0.25)',
          bar: '#f59e0b'
        };
      case 'info':
      default:
        return {
          border: '#3b82f6',
          bg: 'rgba(255, 255, 255, 0.98)',
          iconColor: '#3b82f6',
          glow: 'rgba(59, 130, 246, 0.25)',
          bar: '#3b82f6'
        };
    }
  };

  return (
    <>
      {/* FLOATING TOAST CONTAINER */}
      <div
        style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 999999,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          pointerEvents: 'none',
          maxWidth: '420px',
          width: 'calc(100vw - 48px)'
        }}
      >
        {toasts.map((t) => {
          const colors = getToastColors(t.type);
          return (
            <div
              key={t.id}
              style={{
                pointerEvents: 'auto',
                background: colors.bg,
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                borderRadius: '12px',
                padding: '14px 18px',
                borderLeft: `5px solid ${colors.border}`,
                boxShadow: `0 12px 30px rgba(0, 0, 0, 0.12), 0 0 15px ${colors.glow}`,
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                position: 'relative',
                overflow: 'hidden',
                animation: 'slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                border: `1px solid rgba(226, 232, 240, 0.8)`
              }}
            >
              <div
                style={{
                  fontSize: '1.35rem',
                  color: colors.iconColor,
                  lineHeight: 1,
                  marginTop: '2px',
                  flexShrink: 0
                }}
              >
                <i className={`fa-solid ${getToastIcon(t.type)}`}></i>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {t.title && (
                  <h4
                    style={{
                      margin: '0 0 3px 0',
                      fontSize: '0.92rem',
                      fontWeight: 700,
                      color: '#0f172a',
                      fontFamily: "'Outfit', sans-serif"
                    }}
                  >
                    {t.title}
                  </h4>
                )}
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.82rem',
                    color: '#475569',
                    lineHeight: 1.45,
                    wordBreak: 'break-word'
                  }}
                >
                  {t.message}
                </p>
              </div>

              <button
                type="button"
                onClick={() => removeToast(t.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  padding: '2px',
                  lineHeight: 1,
                  flexShrink: 0,
                  transition: 'color 0.2s ease'
                }}
                onMouseEnter={(e) => (e.target.style.color = '#0f172a')}
                onMouseLeave={(e) => (e.target.style.color = '#94a3b8')}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>

              {/* Progress bar timer */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  height: '3px',
                  background: colors.bar,
                  width: '100%',
                  animation: `progressBar ${t.duration || 4000}ms linear forwards`
                }}
              />
            </div>
          );
        })}
      </div>

      {/* MODERN CONFIRMATION MODAL */}
      {confirmDialog && confirmDialog.isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.72)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999999,
            padding: '1rem',
            animation: 'fadeIn 0.25s ease'
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '2rem 1.75rem',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.3)',
              textAlign: 'center',
              animation: 'modalPop 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              border: '1px solid rgba(226, 232, 240, 0.8)'
            }}
          >
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: confirmDialog.type === 'danger' ? '#fef2f2' : '#fffbeb',
                color: confirmDialog.type === 'danger' ? '#ef4444' : '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.75rem',
                margin: '0 auto 1.25rem',
                boxShadow: `0 0 20px ${confirmDialog.type === 'danger' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`
              }}
            >
              <i className={`fa-solid ${confirmDialog.type === 'danger' ? 'fa-trash' : 'fa-triangle-exclamation'}`}></i>
            </div>

            <h3
              style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                color: '#0f172a',
                marginBottom: '0.6rem',
                fontFamily: "'Outfit', sans-serif"
              }}
            >
              {confirmDialog.title || 'Are you sure?'}
            </h3>

            <p
              style={{
                fontSize: '0.9rem',
                color: '#64748b',
                lineHeight: 1.5,
                marginBottom: '1.75rem'
              }}
            >
              {confirmDialog.message}
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                style={{
                  flex: 1,
                  padding: '0.75rem 1.25rem',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {confirmDialog.cancelText || 'Cancel'}
              </button>

              <button
                type="button"
                onClick={() => {
                  const onConfirm = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  if (onConfirm) onConfirm();
                }}
                style={{
                  flex: 1,
                  padding: '0.75rem 1.25rem',
                  background: confirmDialog.type === 'danger' ? '#ef4444' : 'var(--brand-emerald)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxShadow: confirmDialog.type === 'danger' ? '0 4px 14px rgba(239, 68, 68, 0.35)' : '0 4px 14px rgba(16, 185, 129, 0.35)',
                  transition: 'all 0.2s ease'
                }}
              >
                {confirmDialog.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Toast CSS Animations */}
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes progressBar {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalPop {
          from {
            transform: scale(0.9);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}
