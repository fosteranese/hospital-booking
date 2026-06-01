import { BrowserRouter, Routes, Route } from 'react-router-dom';
import BookAppointment from '@/pages/BookAppointment';
import { AuthProvider } from '@/contexts/auth-context';
import { ClinicProvider } from '@/contexts/clinic-context';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ClinicProvider>
          <Routes>
            <Route path="*" element={<BookAppointment />} />
          </Routes>
        </ClinicProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
