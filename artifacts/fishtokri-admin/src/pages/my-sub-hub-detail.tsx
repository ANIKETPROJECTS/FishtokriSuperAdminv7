import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, MapPin, Store, Tag, CheckCircle2, XCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function getToken() {
  return localStorage.getItem("fishtokri_token") || "";
}

function useAllSubHubs() {
  return useQuery({
    queryKey: ["all-sub-hubs"],
    queryFn: async () => {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
      const res = await fetch(`${base}/api/sub-hubs`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Failed to fetch sub hubs");
      return res.json() as Promise<{ subHubs: any[]; total: number }>;
    },
  });
}

export default function MySubHubDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const subHubId = params.id;

  const { data, isLoading } = useAllSubHubs();
  const sub = (data?.subHubs || []).find((s) => s.id === subHubId);

  const pincodes: string[] = sub?.pincodes || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setLocation("/my-sub-hubs")}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-[#162B4D] transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <Skeleton className="h-8 w-48" />
          ) : sub ? (
            <>
              <h2 className="text-2xl font-bold text-[#162B4D] flex items-center gap-2 flex-wrap">
                {sub.name}
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    sub.status === "Active"
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-500"
                  }`}
                >
                  {sub.status}
                </span>
              </h2>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                {sub.location && (
                  <p className="text-gray-500 text-sm flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {sub.location}
                  </p>
                )}
                {sub.superHubName && (
                  <p className="text-gray-400 text-sm">
                    Under: <span className="font-medium text-gray-500">{sub.superHubName}</span>
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="text-gray-500">Sub hub not found.</p>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : sub ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-teal-100 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center mb-3">
                <Store className="w-5 h-5 text-teal-600" />
              </div>
              <p className="text-2xl font-bold text-[#162B4D]">{sub.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">Sub Hub Name</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-purple-100 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center mb-3">
                <MapPin className="w-5 h-5 text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-[#162B4D]">{pincodes.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">Service Pincodes</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm col-span-2 lg:col-span-1">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
                  sub.status === "Active" ? "bg-green-50" : "bg-red-50"
                }`}
              >
                {sub.status === "Active" ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
              <p
                className={`text-2xl font-bold ${
                  sub.status === "Active" ? "text-green-600" : "text-red-500"
                }`}
              >
                {sub.status}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Current Status</p>
            </div>
          </div>

          {/* Sub Hub Info Card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="relative h-28 bg-gradient-to-br from-teal-500 to-teal-700">
              {sub.imageUrl && (
                <img
                  src={sub.imageUrl}
                  alt={sub.name}
                  className="absolute inset-0 w-full h-full object-cover opacity-30"
                />
              )}
              <div className="absolute inset-0 flex items-center px-6 gap-4">
                <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                  <Store className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="text-white font-bold text-lg">{sub.name}</p>
                  {sub.location && (
                    <p className="text-white/70 text-sm flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      {sub.location}
                    </p>
                  )}
                </div>
                <span
                  className={`ml-auto text-xs font-bold px-3 py-1 rounded-full ${
                    sub.status === "Active"
                      ? "bg-green-400/90 text-white"
                      : "bg-red-400/90 text-white"
                  }`}
                >
                  {sub.status}
                </span>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                    Super Hub
                  </p>
                  <p className="font-medium text-[#162B4D]">{sub.superHubName || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                    Location
                  </p>
                  <p className="font-medium text-[#162B4D]">{sub.location || "—"}</p>
                </div>
              </div>

              {/* Pincodes */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="w-4 h-4 text-purple-500" />
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Service Pincodes ({pincodes.length})
                  </p>
                </div>
                {pincodes.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {pincodes.map((p) => (
                      <span
                        key={p}
                        className="bg-purple-50 text-purple-700 text-sm font-semibold px-3 py-1 rounded-full border border-purple-100"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No pincodes assigned to this sub hub.</p>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-16 text-center">
          <Store className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Sub hub not found or you don't have access.</p>
        </div>
      )}
    </div>
  );
}
