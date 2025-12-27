import {
  Navigate,
  Route,
  Routes,
  BrowserRouter as Router,
} from "react-router-dom";

import { DBAPage } from "@/components/DBAPage";
import { NBAPage } from "@/components/NBAPage";
import { Navbar } from "@/components/Navbar";
import { PlaceholderPage } from "@/components/PlaceholderPage";

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-950 text-slate-50">
        <Navbar />
        <main className="pb-12">
          <Routes>
            <Route path="/" element={<Navigate to="/dba" replace />} />
            <Route path="/dba" element={<DBAPage />} />
            <Route path="/nba" element={<NBAPage />} />
            <Route
              path="*"
              element={
                <PlaceholderPage
                  title="Not found"
                  note="Route does not exist."
                />
              }
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
