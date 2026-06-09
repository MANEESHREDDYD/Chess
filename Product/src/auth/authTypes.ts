export interface AuthUser {
  id: string;
  email?: string;
  display_name?: string;
  created_at?: string;
}

export interface AuthState {
  status: "loading" | "signed_out" | "signed_in" | "error";
  user?: AuthUser;
  error?: string;
}
