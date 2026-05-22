import { BrowserRouter, Routes, Route } from 'react-router-dom';
import BookAppointment from '@/pages/BookAppointment';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<BookAppointment />} />
      </Routes>
    </BrowserRouter>
  );
}
