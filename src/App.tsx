import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
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

// export default function App() {
//     const [open, setOpen] = useState(false);

//     const data = [
//         { id: 1, name: "Alice", role: "Developer" },
//         { id: 2, name: "Bob", role: "Designer" },
//         { id: 3, name: "Chloe", role: "PM" },
//     ];

//     return (
//         <>
//             {/* Trigger */}
//             <main className="flex min-h-screen items-center justify-center bg-slate-100">
//                 <button
//                     onClick={() => setOpen(true)}
//                     className="rounded bg-sky-600 px-4 py-2 text-white shadow hover:bg-sky-700"
//                 >
//                     Open Modal
//                 </button>
//             </main>

//             {/* Modal */}
//             {open && (
//                 <div
//                     className="fixed inset-0 z-0 flex items-center justify-center bg-black/20 backdrop-blur"
//                     onClick={() => setOpen(false)}
//                 >
//                     <div
//                         className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
//                         onClick={(e) => e.stopPropagation()} // prevent overlay close
//                     >
//                         {/* Title */}
//                         <h2 className="mb-4 text-xl font-semibold text-slate-800">
//                             User List
//                         </h2>

//                         {/* Table */}
//                         <table className="w-full text-left text-sm">
//                             <thead>
//                                 <tr className="border-b border-slate-300">
//                                     <th className="py-2 pr-2">ID</th>
//                                     <th className="py-2 px-2">Name</th>
//                                     <th className="py-2 pl-2">Role</th>
//                                 </tr>
//                             </thead>
//                             <tbody>
//                                 {data.map((u) => (
//                                     <tr
//                                         key={u.id}
//                                         className="border-b border-slate-200 last:border-none"
//                                     >
//                                         <td className="py-2 pr-2">{u.id}</td>
//                                         <td className="py-2 px-2">{u.name}</td>
//                                         <td className="py-2 pl-2">{u.role}</td>
//                                     </tr>
//                                 ))}
//                             </tbody>
//                         </table>

//                         {/* Close */}
//                         <div className="mt-4 text-right">
//                             <button
//                                 onClick={() => setOpen(false)}
//                                 className="rounded bg-slate-200 px-3 py-1 text-sm hover:bg-slate-300"
//                             >
//                                 Close
//                             </button>
//                         </div>
//                     </div>
//                 </div>
//             )}
//         </>
//     );
// }

// function App() {
//   return (
//     <main className="grid h-screen place-items-center bg-slate-900 text-white">
//       <h1 className="text-6xl font-bold text-sky-600">
//         React + TS + Tailwind v4 🎉
//       </h1>
//     </main>
//   );
// }
// export default App;
