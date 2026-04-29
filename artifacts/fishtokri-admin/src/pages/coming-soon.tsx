import { Building2 } from "lucide-react";

export default function ComingSoon() {
  return (
    <div className="h-[80vh] flex flex-col items-center justify-center text-center px-4">
      <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6">
        <Building2 className="w-10 h-10 text-[#1A56DB]" />
      </div>
      <h2 className="text-3xl font-bold text-[#1E3A5F] mb-3">Coming Soon</h2>
      <p className="text-gray-500 max-w-md text-lg">
        This feature is currently under development. Check back later for updates.
      </p>
    </div>
  );
}
