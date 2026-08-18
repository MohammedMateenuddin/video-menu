import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import CustomerMenu from "./pages/customer/CustomerMenu";
import Login from "./pages/auth/Login";
import AdminDashboard from "./pages/admin/AdminDashboard";
import Dashboard from "./pages/restaurant/Dashboard";
import Menu from "./pages/restaurant/Menu";
import AdminRoute from "./components/AdminRoute";
import Categories from "./pages/restaurant/Categories";
import QRCode from "./pages/restaurant/QRCode";
import Settings from "./pages/restaurant/Settings";
import AdminLogin from "./pages/admin/AdminLogin";
import RestaurantLayout from "./layouts/RestaurantLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import ManageRestaurant from "./pages/admin/ManageRestaurant";
import Restaurants from "./pages/admin/Restaurants";
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />{" "}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin/restaurants"
          element={
            <AdminRoute>
              <Restaurants />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/restaurants/:restaurantId"
          element={
            <AdminRoute>
              <ManageRestaurant />
            </AdminRoute>
          }
        />
        {/* Authentication */}
        <Route path="/login" element={<Login />} />
        <Route path="/r/:restaurantSlug" element={<CustomerMenu />} />
        {/* Restaurant Dashboard */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <RestaurantLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />

          <Route path="menu" element={<Menu />} />

          <Route path="categories" element={<Categories />} />

          <Route path="qr" element={<QRCode />} />

          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
