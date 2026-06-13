export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      events: {
        Row: {
          id: string;
          org_id: string;
          slug: string;
          name: string;
          description: string | null;
          starts_at: string | null;
          ends_at: string | null;
          status: "draft" | "live" | "archived";
          map_center: unknown;
          map_zoom: number;
          viewer_location_retention_days: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["events"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["events"]["Row"]>;
      };
      trackers: {
        Row: {
          id: string;
          event_id: string;
          name: string;
          description: string | null;
          group_name: string | null;
          icon_url: string | null;
          icon_color: string | null;
          secret_token: string;
          device_type: "pwa" | "soracom_lte" | "android_agent" | "pi_agent" | "external";
          soracom_sim_id: string | null;
          external_device_id: string | null;
          is_active: boolean;
          last_seen_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["trackers"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["trackers"]["Row"]>;
      };
      tracker_locations: {
        Row: {
          tracker_id: string;
          event_id: string;
          location: unknown;
          heading: number | null;
          speed: number | null;
          accuracy: number | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tracker_locations"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["tracker_locations"]["Row"]>;
      };
      pois: {
        Row: {
          id: string;
          event_id: string;
          name: string;
          kind: "toilet" | "parking" | "shelter" | "food" | "other";
          location: unknown;
          description: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["pois"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["pois"]["Row"]>;
      };
      routes: {
        Row: {
          id: string;
          event_id: string;
          name: string;
          path: unknown;
          is_visible: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["routes"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["routes"]["Row"]>;
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["organizations"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["organizations"]["Row"]>;
      };
      organization_members: {
        Row: {
          org_id: string;
          user_id: string;
          role: "owner" | "editor" | "viewer";
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["organization_members"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["organization_members"]["Row"]>;
      };
      viewer_sessions: {
        Row: {
          id: string;
          event_id: string;
          session_token: string;
          consented_at: string;
          last_seen_at: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["viewer_sessions"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["viewer_sessions"]["Row"]>;
      };
      viewer_location_points: {
        Row: {
          id: number;
          session_id: string;
          event_id: string;
          location: unknown;
          accuracy: number | null;
          recorded_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["viewer_location_points"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["viewer_location_points"]["Row"]>;
      };
    };
  };
};

export type ViewerLocationPointRow =
  Database["public"]["Tables"]["viewer_location_points"]["Row"];

export type TrackerLocationRow =
  Database["public"]["Tables"]["tracker_locations"]["Row"];
export type TrackerRow = Database["public"]["Tables"]["trackers"]["Row"];
export type EventRow = Database["public"]["Tables"]["events"]["Row"];
export type PoiRow = Database["public"]["Tables"]["pois"]["Row"];
export type RouteRow = Database["public"]["Tables"]["routes"]["Row"];

export type TrackerWithLocation = TrackerRow & {
  location?: TrackerLocationRow | null;
};
