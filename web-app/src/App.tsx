import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import SplashScreen from "./screens/SplashScreen";
import LoginScreen from "./screens/LoginScreen";
import SignupScreen from "./screens/SignupScreen";
import HomeScreen from "./screens/HomeScreen";
import ServerHubScreen from "./screens/ServerHubScreen";
import GamblingScreen from "./screens/GamblingScreen";
import StoreCategoriesScreen from "./screens/StoreCategoriesScreen";
import StoreItemsScreen from "./screens/StoreItemsScreen";
import AdminStoreScreen from "./screens/AdminStoreScreen";
import LeaderboardScreen from "./screens/LeaderboardScreen";
import AddServerScreen from "./screens/AddServerScreen";
import PayPalCheckoutScreen from "./screens/PayPalCheckoutScreen";
import ServerSetupScreen from "./screens/ServerSetupScreen";
import ServerSettingsScreen from "./screens/ServerSettingsScreen";
import ServerConfigsScreen from "./screens/ServerConfigsScreen";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SplashScreen />} />
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/signup" element={<SignupScreen />} />
          <Route path="/home" element={<HomeScreen />} />
          <Route path="/server/:serverId" element={<ServerHubScreen />} />
          <Route path="/server/:serverId/gambling" element={<GamblingScreen />} />
          <Route path="/server/:serverId/store" element={<StoreCategoriesScreen />} />
          <Route path="/server/:serverId/store/:categoryId" element={<StoreItemsScreen />} />
          <Route path="/admin/store" element={<AdminStoreScreen />} />
          <Route path="/server/:serverId/leaderboard" element={<LeaderboardScreen />} />
          <Route path="/add-server" element={<AddServerScreen />} />
          <Route path="/checkout/:planId" element={<PayPalCheckoutScreen />} />
          <Route path="/setup-server" element={<ServerSetupScreen />} />
          <Route path="/server-settings" element={<ServerSettingsScreen />} />
          <Route path="/server-configs" element={<ServerConfigsScreen />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
