import { create } from "zustand";

interface AuthState {
  isAuthenticated: boolean;
  login: (email: string, pass: string) => boolean;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  isAuthenticated: localStorage.getItem("zeus_auth") === "true",
  login: (email, pass) => {
    if (email === "gabrielaalmeida6781@gmail.com" && pass === "@gabriela 124") {
      localStorage.setItem("zeus_auth", "true");
      set({ isAuthenticated: true });
      return true;
    }
    return false;
  },
  logout: () => {
    localStorage.removeItem("zeus_auth");
    set({ isAuthenticated: false });
  },
}));
