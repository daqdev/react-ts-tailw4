import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from './routes/HomePage';
// import SprintWizardPage from '@/routes/SprintWizardPage';


export default function App() {
  return (
      <BrowserRouter>
          <Routes>
              <Route path="/" element={<HomePage />} />
              {/* <Route path="/wizard" element={<SprintWizardPage />} /> */}
          </Routes>
      </BrowserRouter>
  );
}
