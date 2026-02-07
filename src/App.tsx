import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import ImportPage from "./pages/ImportPage";
import JudgesPage from "./pages/JudgesPage";
import QueuePage from "./pages/QueuePage";
import ResultsPage from "./pages/ResultsPage";

export default function App() {
  return (
    <BrowserRouter>
      <nav style={{ display: "flex", gap: "1rem", padding: "1rem" }}>
        <Link to="/import">Import</Link>
        <Link to="/judges">Judges</Link>
        <Link to="/queues/queue_1">Queues</Link>
        <Link to="/results">Results</Link>
      </nav>

      <Routes>
        <Route path="/import" element={<ImportPage />} />
        <Route path="/judges" element={<JudgesPage />} />
        <Route path="/queues/:queueId" element={<QueuePage />} />
        <Route path="/results" element={<ResultsPage />} />
      </Routes>
    </BrowserRouter>
  );
}
