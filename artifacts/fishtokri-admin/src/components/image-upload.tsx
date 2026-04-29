import { useRef, useState } from "react";
import { Upload, Link, X, Loader2, ImageIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function getToken() {
  return localStorage.getItem("fishtokri_token") || "";
}

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  folder?: string;
  label?: string;
  previewClassName?: string;
}

function getDisplayName(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || url;
  } catch {
    return url;
  }
}

export function ImageUpload({ value, onChange, folder = "fishtokri", label = "Image", previewClassName = "w-16 h-16 rounded-lg" }: ImageUploadProps) {
  const [mode, setMode] = useState<"url" | "upload">("url");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");
    setUploading(true);
    try {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch(`${base}/api/upload?folder=${folder}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Upload failed");
      onChange(data.url);
    } catch (err: any) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold text-gray-600">{label}</Label>

      {value && (
        <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border border-gray-100">
          <img src={value} alt="preview" className={`${previewClassName} object-cover flex-shrink-0 border border-gray-200`} />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 truncate font-medium">{getDisplayName(value)}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Image ready</p>
          </div>
          <button
            type="button"
            onClick={() => onChange("")}
            className="w-6 h-6 flex items-center justify-center rounded-full bg-red-50 text-red-400 hover:text-red-600 flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium border transition-colors ${mode === "url" ? "bg-[#162B4D] text-white border-[#162B4D]" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
        >
          <Link className="w-3.5 h-3.5" />
          Image URL
        </button>
        <button
          type="button"
          onClick={() => { setMode("upload"); fileRef.current?.click(); }}
          className={`flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium border transition-colors ${mode === "upload" ? "bg-[#162B4D] text-white border-[#162B4D]" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {uploading ? "Uploading..." : "Upload File"}
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {mode === "url" && (
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          <ImageIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://..."
            className="h-8 text-xs min-w-0 flex-1"
          />
        </div>
      )}

      {uploadError && (
        <p className="text-xs text-red-500">{uploadError}</p>
      )}
    </div>
  );
}
