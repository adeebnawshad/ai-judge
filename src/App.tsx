import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import ImportPage from "./pages/ImportPage";
import JudgesPage from "./pages/JudgesPage";
import QueuePage from "./pages/QueuePage";
import ResultsPage from "./pages/ResultsPage";
import SubmissionsPage from "./pages/SubmissionsPage";

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="app-header">
          <div className="app-header-inner">
            <div className="app-logo">
              <span className="app-logo-mark">⚖️</span>
              <div>
                <div className="app-logo-title">AI Judge</div>
                <div className="app-logo-subtitle">Review queues with LLMs</div>
              </div>
            </div>

            <nav className="app-nav">
              <NavLink
                to="/import"
                className={({ isActive }) =>
                  `app-nav-link ${isActive ? "app-nav-link-active" : ""}`
                }
              >
                Import
              </NavLink>

              <NavLink
                to="/submissions"
                className={({ isActive }) =>
                  `app-nav-link ${isActive ? "app-nav-link-active" : ""}`
                }
              >
                Submissions
              </NavLink>

              <NavLink
                to="/judges"
                className={({ isActive }) =>
                  `app-nav-link ${isActive ? "app-nav-link-active" : ""}`
                }
              >
                Judges
              </NavLink>

              <NavLink
                to="/queues/queue_1"
                className={({ isActive }) =>
                  `app-nav-link ${isActive ? "app-nav-link-active" : ""}`
                }
              >
                Queue
              </NavLink>

              <NavLink
                to="/results"
                className={({ isActive }) =>
                  `app-nav-link ${isActive ? "app-nav-link-active" : ""}`
                }
              >
                Results
              </NavLink>
            </nav>
          </div>
        </header>

        <main className="app-main">
          <div className="app-main-inner">
            <Routes>
              {/* Default: send / to Import */}
              <Route path="/" element={<Navigate to="/import" replace />} />

              <Route path="/import" element={<ImportPage />} />
              <Route path="/submissions" element={<SubmissionsPage />} />
              <Route path="/judges" element={<JudgesPage />} />
              <Route path="/queues/:queueId" element={<QueuePage />} />
              <Route path="/results" element={<ResultsPage />} />

              {/* Fallback for unknown routes */}
              <Route path="*" element={<Navigate to="/import" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}
