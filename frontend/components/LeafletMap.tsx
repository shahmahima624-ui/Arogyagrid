"use client";

import React, { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { FacilityMarker, TransferRoute } from "../app/(dashboard)/map/page";

interface LeafletMapProps {
  markers: FacilityMarker[];
  routes: TransferRoute[];
  centerLat: number;
  centerLng: number;
  onSelectMarker: (marker: FacilityMarker) => void;
}

const COLOR_HEX: Record<string, string> = {
  green: "#10b981",
  yellow: "#f59e0b",
  orange: "#f97316",
  red: "#ef4444",
  purple: "#a855f7",
};

// Component to dynamically re-center map when props change
function MapRecenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

export default function LeafletMap({
  markers,
  routes,
  centerLat,
  centerLng,
  onSelectMarker,
}: LeafletMapProps) {
  return (
    <div className="h-[560px] w-full rounded-2xl overflow-hidden border border-slate-800 shadow-xl relative z-0">
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={10}
        scrollWheelZoom={true}
        className="h-full w-full bg-slate-950"
      >
        <MapRecenter lat={centerLat} lng={centerLng} />

        {/* Dark map tiles via CartoDB Dark Matter */}
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* Render Transfer Routes as cyan dashed polylines */}
        {routes.map((r, idx) => (
          <Polyline
            key={`route-${idx}`}
            positions={[
              [r.source_lat, r.source_lng],
              [r.destination_lat, r.destination_lng],
            ]}
            pathOptions={{
              color: "#06b6d4",
              weight: 3,
              dashArray: "6, 8",
              opacity: 0.8,
            }}
          >
            <Popup>
              <div className="text-xs text-slate-900 font-sans">
                <div className="font-bold text-cyan-700">Stock Transfer Route</div>
                <div>Medicine: <b>{r.medicine_name}</b></div>
                <div>Quantity: <b>{r.quantity}</b></div>
                <div>Status: <b>{r.status}</b></div>
              </div>
            </Popup>
          </Polyline>
        ))}

        {/* Render Facility Markers as Circle Markers */}
        {markers.map((m) => {
          const hexColor = COLOR_HEX[m.risk_color] || "#64748b";
          return (
            <CircleMarker
              key={m.id}
              center={[m.latitude, m.longitude]}
              radius={10}
              pathOptions={{
                color: hexColor,
                fillColor: hexColor,
                fillOpacity: 0.85,
                weight: 2,
              }}
              eventHandlers={{
                click: () => onSelectMarker(m),
              }}
            >
              <Popup>
                <div className="text-xs font-sans text-slate-900 p-1">
                  <div className="font-bold text-sm text-slate-950">{m.name}</div>
                  <div className="text-slate-600 font-medium mb-1">{m.facility_type} • {m.district_name}</div>
                  <div className="mt-1 pt-1 border-t border-slate-200">
                    <div>Status: <b style={{ color: hexColor }}>{m.risk_label}</b></div>
                    <div>Critical Meds: <b>{m.critical_medicines}</b></div>
                    <div>Expiring Soon: <b>{m.expiring_soon}</b></div>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
