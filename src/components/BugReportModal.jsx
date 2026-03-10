function BugReportModal({ isOpen, onClose, colors }) {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        zIndex: 9999,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(92vw, 640px)",
          background: "#ffffff",
          border: `1px solid ${colors.subtleBorder}`,
          borderRadius: "24px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "20px 22px",
            borderBottom: `1px solid ${colors.subtleBorder}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "20px",
                fontWeight: 800,
                color: colors.text,
              }}
            >
              Report a Bug or give a suggestion 
            </div>
            <div
              style={{
                fontSize: "14px",
                color: colors.muted,
                marginTop: "4px",
              }}
            >
              Send a quick bug report directly to Basel.
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              border: `1px solid ${colors.subtleBorder}`,
              background: "#ffffff",
              color: colors.text,
              borderRadius: "12px",
              width: "36px",
              height: "36px",
              cursor: "pointer",
              fontSize: "18px",
              lineHeight: 1,
            }}
            aria-label="Close bug report form"
          >
            ×
          </button>
        </div>

        <form
          action="https://formsubmit.co/baselkadhem@icloud.com"
          method="POST"
          style={{
            padding: "22px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <input
            type="hidden"
            name="_subject"
            value="Bug Report - Basel Hasan Website"
          />
          <input
            type="hidden"
            name="_next"
            value="https://baselhasan.com/"
          />
          <input
            type="hidden"
            name="_template"
            value="table"
          />
          <input
            type="text"
            name="_honey"
            style={{ display: "none" }}
            tabIndex="-1"
            autoComplete="off"
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div>
              <label
                htmlFor="bug-name"
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: 700,
                  marginBottom: "8px",
                  color: colors.text,
                }}
              >
                Name
              </label>
              <input
                id="bug-name"
                type="text"
                name="name"
                required
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: "14px",
                  border: `1px solid ${colors.subtleBorder}`,
                  fontSize: "15px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label
                htmlFor="bug-email"
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: 700,
                  marginBottom: "8px",
                  color: colors.text,
                }}
              >
                Email
              </label>
              <input
                id="bug-email"
                type="email"
                name="email"
                required
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: "14px",
                  border: `1px solid ${colors.subtleBorder}`,
                  fontSize: "15px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="bug-page"
              style={{
                display: "block",
                fontSize: "14px",
                fontWeight: 700,
                marginBottom: "8px",
                color: colors.text,
              }}
            >
              Page / Tab
            </label>
            <input
              id="bug-page"
              type="text"
              name="page"
              placeholder="Example: Germany tab, Resume page, Contact card"
              required
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "14px",
                border: `1px solid ${colors.subtleBorder}`,
                fontSize: "15px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="bug-message"
              style={{
                display: "block",
                fontSize: "14px",
                fontWeight: 700,
                marginBottom: "8px",
                color: colors.text,
              }}
            >
              What happened?
            </label>
            <textarea
              id="bug-message"
              name="message"
              rows="6"
              placeholder="Describe the bug, what you expected, and how to reproduce it."
              required
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "14px",
                border: `1px solid ${colors.subtleBorder}`,
                fontSize: "15px",
                outline: "none",
                resize: "vertical",
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
              marginTop: "4px",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "12px 16px",
                borderRadius: "14px",
                border: `1px solid ${colors.subtleBorder}`,
                background: "#ffffff",
                color: colors.text,
                cursor: "pointer",
                fontSize: "15px",
                fontWeight: 700,
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              style={{
                padding: "12px 18px",
                borderRadius: "14px",
                border: `1px solid ${colors.border}`,
                background: colors.text,
                color: "#ffffff",
                cursor: "pointer",
                fontSize: "15px",
                fontWeight: 700,
              }}
            >
              Send Report
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default BugReportModal;