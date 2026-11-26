// Proof of delivery (backlog DEL-1): what the driver captured at the door in Driver Mode — who received the goods, their
// signature drawn on the phone, photos, where and when, and whether they read back the one-time code sent to the
// customer's mobile. Shown on delivery notes (and their PDF), delivery orders, sales orders, invoices and the customer
// portal. Shapes follow delivery-service DeliveryProofService.ProofView.
import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import axios from "axios";
import { BadgeCheckIcon, CameraIcon, ImageIcon, MapPinIcon, PenLineIcon, ShieldCheckIcon, XIcon } from "lucide-react";
import { DELIVERY_API } from "./deliveryShared";
import { formatDateTime as companyDateTime } from "../../company/format";
import { language, t, useLanguage } from "../../i18n/i18n";

export const PROOF_API = `${DELIVERY_API}/proofs`;

export interface ProofFile {
  id: number;
  kind: "SIGNATURE" | "PHOTO";
  contentType: string;
  size: number;
}

export interface DeliveryProof {
  id: number;
  deliveryOrderId: number;
  deliveryOrderNumber?: string;
  salesOrderId?: number | null;
  customerId?: number;
  customerName?: string;
  status: "DELIVERED" | "PARTIAL";
  receiverName: string;
  receiverMobile?: string | null;
  remarks?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  // PHONE: the phone's GPS at the door; TRIP: the trip's last known position
  positionSource?: "PHONE" | "TRIP" | null;
  mapUrl?: string | null;
  capturedAt: string;
  capturedBy?: string;
  vehiclePlate?: string | null;
  codeVerified: boolean;
  codeSentTo?: string | null;
  signature?: ProofFile | null;
  photos: ProofFile[];
}

/* ================= Labels (English wording is the key; Arabic here so the shared dictionary stays untouched) ================= */

const AR: Record<string, string> = {
  "Proof of delivery": "إثبات التسليم",
  "No proof of delivery yet": "لا يوجد إثبات تسليم بعد",
  "Proof of delivery is captured by the driver in Driver Mode.": "يسجّل السائق إثبات التسليم من وضع السائق.",
  "Received by": "استلمها",
  "Mobile": "الجوال",
  "Captured": "وقت التسجيل",
  "by {name}": "بواسطة {name}",
  "Open map": "فتح الخريطة",
  "Phone GPS at the door": "موقع الهاتف عند التسليم",
  "Trip's last position": "آخر موقع للرحلة",
  "No location (no HTTPS or GPS)": "لا يوجد موقع (لا HTTPS أو GPS)",
  "Code confirmed": "تم تأكيد الرمز",
  "sent to {to}": "أُرسل إلى {to}",
  "Signature": "التوقيع",
  "Photos": "الصور",
  "Delivered": "تم التسليم",
  "Partly delivered": "تسليم جزئي",
  "Note": "ملاحظة",
  "Loading proof of delivery…": "جارٍ تحميل إثبات التسليم…",
  "Could not load the proof of delivery": "تعذر تحميل إثبات التسليم",
  "Receiver's name *": "اسم المستلم *",
  "Receiver's mobile": "جوال المستلم",
  "e.g. Ahmed Ali, store keeper": "مثال: أحمد علي، أمين المخزن",
  "Signature *": "التوقيع *",
  "Ask the receiver to sign with a finger": "اطلب من المستلم التوقيع بإصبعه",
  "Clear": "مسح",
  "Take photo": "التقاط صورة",
  "Choose photo": "اختيار صورة",
  "Up to {n} photos": "حتى {n} صور",
  "Remove photo": "إزالة الصورة",
  "One-time code (optional)": "رمز لمرة واحدة (اختياري)",
  "Send code": "إرسال الرمز",
  "Sending…": "جارٍ الإرسال…",
  "Code sent to {to} by {channels}. Ask the receiver to read it out.": "أُرسل الرمز إلى {to} عبر {channels}. اطلب من المستلم قراءته.",
  "6-digit code": "رمز من 6 أرقام",
  "With a confirmed code, the signature is optional.": "مع رمز مؤكد يصبح التوقيع اختياريًا.",
  "Location: phone GPS (±{m} m)": "الموقع: GPS الهاتف (±{m} م)",
  "Getting your location…": "جارٍ تحديد موقعك…",
  "No GPS: the trip's last position is used.": "لا يوجد GPS: يُستخدم آخر موقع للرحلة.",
  "Camera and location need HTTPS. Signature and receiver name still work; photos can be chosen from the gallery.":
    "الكاميرا والموقع يحتاجان إلى HTTPS. التوقيع واسم المستلم يعملان؛ ويمكن اختيار الصور من المعرض.",
  "Enter the receiver's name": "أدخل اسم المستلم",
  "Ask the receiver to sign, or to read back the code": "اطلب من المستلم التوقيع أو قراءة الرمز",
  "Enter the customer's mobile number": "أدخل رقم جوال العميل",
  "Proof of delivery saved": "تم حفظ إثبات التسليم",
  "Proof": "الإثبات",
  "Close": "إغلاق",
};

/** The text in the screen language (this module's Arabic first, then the shared dictionary). */
export const tp = (text: string, vars?: Record<string, string | number>): string => {
  const own = language() === "ar" ? AR[text] : undefined;
  if (!own) return t(text, vars);
  return vars ? own.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : own;
};

const statusLabel = (status: DeliveryProof["status"]) => tp(status === "PARTIAL" ? "Partly delivered" : "Delivered");

/* ================= Files (fetched with the sign-in token, shown from memory) ================= */

export const officeFileUrl = (proof: DeliveryProof, file: ProofFile) => `${PROOF_API}/${proof.id}/files/${file.id}`;

/** A protected image as an object URL (null while loading or when it failed). */
export const useAuthImage = (url?: string | null): string | null => {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return;
    let revoked = false;
    let objectUrl: string | null = null;
    axios
      .get(url, { responseType: "blob" })
      .then(({ data }) => {
        if (revoked) return;
        objectUrl = URL.createObjectURL(data);
        setSrc(objectUrl);
      })
      .catch(() => setSrc(null));
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);
  return src;
};

/** A protected image as a data URL, for the PDF. */
export const imageDataUrl = async (url: string): Promise<string | null> => {
  try {
    const { data } = await axios.get<Blob>(url, { responseType: "blob" });
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(data);
    });
  } catch {
    return null;
  }
};

const AuthImage: React.FC<{ url: string; alt: string; className?: string; onOpen?: (src: string) => void }> = ({ url, alt, className, onOpen }) => {
  const src = useAuthImage(url);
  if (!src) return <div className={`${className ?? ""} animate-pulse bg-slate-100`} aria-label={alt} />;
  return onOpen ? (
    <button type="button" onClick={() => onOpen(src)} className="block" title={alt}>
      <img src={src} alt={alt} className={className} />
    </button>
  ) : (
    <img src={src} alt={alt} className={className} />
  );
};

/* ================= Display ================= */

interface ProofListProps {
  /** Proofs already in hand (e.g. on a delivery order). */
  proofs?: DeliveryProof[];
  /** Otherwise loaded from listUrl (default: office endpoint) with these query parameters. */
  query?: Record<string, number | undefined | null>;
  listUrl?: string;
  fileUrl?: (proof: DeliveryProof, file: ProofFile) => string;
  /** Say so when there is none (otherwise nothing is shown). */
  showEmpty?: boolean;
  className?: string;
}

/** Proof of delivery card(s): receiver, time, map link, code, signature and photos. */
export const ProofOfDelivery: React.FC<ProofListProps> = ({ proofs, query, listUrl = PROOF_API, fileUrl = officeFileUrl, showEmpty, className }) => {
  useLanguage();
  const [loaded, setLoaded] = useState<DeliveryProof[] | null>(proofs ?? null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const queryKey = JSON.stringify(query ?? {});

  useEffect(() => {
    if (proofs) {
      setLoaded(proofs);
      return;
    }
    const params = Object.fromEntries(Object.entries(query ?? {}).filter(([, v]) => v != null));
    if (Object.keys(params).length === 0 && listUrl === PROOF_API) return;
    let cancelled = false;
    setFailed(false);
    axios
      .get<DeliveryProof[]>(listUrl, { params })
      .then(({ data }) => !cancelled && setLoaded(Array.isArray(data) ? data : []))
      .catch(() => {
        if (!cancelled) {
          setLoaded([]);
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [proofs, queryKey, listUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loaded === null) return showEmpty ? <p className="text-xs text-slate-400">{tp("Loading proof of delivery…")}</p> : null;
  if (failed && showEmpty) return <p className="text-xs text-red-500">{tp("Could not load the proof of delivery")}</p>;
  if (loaded.length === 0) {
    return showEmpty ? (
      <div className={className}>
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
          <ShieldCheckIcon className="h-4 w-4 text-slate-400" /> {tp("Proof of delivery")}
        </h3>
        <p className="text-xs text-slate-500">{tp("No proof of delivery yet")} · {tp("Proof of delivery is captured by the driver in Driver Mode.")}</p>
      </div>
    ) : null;
  }

  return (
    <div className={className} data-testid="proof-of-delivery">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
        <ShieldCheckIcon className="h-4 w-4 text-green-600" /> {tp("Proof of delivery")}
      </h3>
      <div className="space-y-3">
        {loaded.map((p) => (
          <div key={p.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-sm dark:border-gray-700 dark:bg-gray-800/60">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-slate-800 dark:text-gray-100">
                {tp("Received by")} {p.receiverName}
                {p.receiverMobile && <span className="font-normal text-slate-500"> · {p.receiverMobile}</span>}
              </p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.status === "PARTIAL" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
                {statusLabel(p.status)}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {tp("Captured")}: {companyDateTime(p.capturedAt, "-")}
              {p.capturedBy && <> · {tp("by {name}", { name: p.capturedBy })}</>}
              {p.vehiclePlate && <> · {p.vehiclePlate}</>}
              {p.deliveryOrderNumber && <> · {p.deliveryOrderNumber}</>}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {p.mapUrl ? (
                <a href={p.mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-cyan-700 hover:underline">
                  <MapPinIcon className="h-3.5 w-3.5" /> {tp("Open map")}
                  <span className="font-normal text-slate-500">
                    ({tp(p.positionSource === "TRIP" ? "Trip's last position" : "Phone GPS at the door")}
                    {p.accuracy != null ? ` ±${Math.round(p.accuracy)} m` : ""})
                  </span>
                </a>
              ) : (
                <span className="inline-flex items-center gap-1 text-slate-400"><MapPinIcon className="h-3.5 w-3.5" /> {tp("No location (no HTTPS or GPS)")}</span>
              )}
              {p.codeVerified && (
                <span className="inline-flex items-center gap-1 font-medium text-green-700">
                  <BadgeCheckIcon className="h-3.5 w-3.5" /> {tp("Code confirmed")}
                  {p.codeSentTo && <span className="font-normal text-slate-500">({tp("sent to {to}", { to: p.codeSentTo })})</span>}
                </span>
              )}
            </div>
            {p.remarks && <p className="mt-1 text-xs text-slate-600 dark:text-gray-300">{tp("Note")}: {p.remarks}</p>}
            {(p.signature || p.photos.length > 0) && (
              <div className="mt-2 flex flex-wrap items-end gap-3">
                {p.signature && (
                  <div>
                    <p className="mb-0.5 text-[11px] uppercase tracking-wide text-slate-400">{tp("Signature")}</p>
                    <AuthImage url={fileUrl(p, p.signature)} alt={tp("Signature")} onOpen={setZoom}
                      className="h-20 w-44 rounded-lg border border-slate-200 bg-white object-contain" />
                  </div>
                )}
                {p.photos.length > 0 && (
                  <div>
                    <p className="mb-0.5 text-[11px] uppercase tracking-wide text-slate-400">{tp("Photos")} ({p.photos.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {p.photos.map((photo) => (
                        <AuthImage key={photo.id} url={fileUrl(p, photo)} alt={tp("Photos")} onOpen={setZoom}
                          className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {zoom && (
        <div data-overlay className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={() => setZoom(null)} role="dialog" aria-modal="true">
          <button type="button" className="absolute end-4 top-4 rounded-full bg-white/90 p-1.5" aria-label={tp("Close")} onClick={() => setZoom(null)}>
            <XIcon className="h-5 w-5" />
          </button>
          <img src={zoom} alt={tp("Proof of delivery")} className="max-h-[90vh] max-w-full rounded-lg bg-white object-contain" />
        </div>
      )}
    </div>
  );
};

/** One line for lists: "✓ Ahmed Ali · 14:05". */
export const ProofBadge: React.FC<{ proof?: DeliveryProof | null }> = ({ proof }) => {
  useLanguage();
  if (!proof) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700" title={tp("Proof of delivery")}>
      <ShieldCheckIcon className="h-3 w-3" /> {proof.receiverName}
    </span>
  );
};

/* ================= Capture (Driver Mode) ================= */

export interface SignaturePadHandle {
  /** The drawing as a PNG, or null when nothing was drawn. */
  toBlob: () => Promise<Blob | null>;
  clear: () => void;
}

/** A finger / mouse signature on a canvas. Works on plain HTTP (no device permission needed). */
export const SignaturePad = React.forwardRef<SignaturePadHandle, { onChange?: (signed: boolean) => void }>(({ onChange }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [signed, setSigned] = useState(false);

  const setup = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
  }, []);

  useEffect(() => {
    setup();
  }, [setup]);

  const mark = (value: boolean) => {
    setSigned(value);
    onChange?.(value);
  };

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    last.current = point(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && last.current) {
      ctx.beginPath();
      ctx.arc(last.current.x, last.current.y, 1.1, 0, Math.PI * 2);
      ctx.fillStyle = "#0f172a";
      ctx.fill();
    }
    if (!signed) mark(true);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    const p = point(e);
    if (ctx && last.current) {
      ctx.beginPath();
      ctx.moveTo(last.current.x, last.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    last.current = p;
  };

  const up = () => {
    drawing.current = false;
    last.current = null;
  };

  useImperativeHandle(ref, () => ({
    toBlob: () =>
      new Promise((resolve) => {
        if (!signed || !canvasRef.current) return resolve(null);
        canvasRef.current.toBlob((blob) => resolve(blob), "image/png");
      }),
    clear: () => {
      setup();
      mark(false);
    },
  }));

  return (
    <div>
      <canvas
        ref={canvasRef}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={up}
        className="h-36 w-full touch-none rounded-xl border-2 border-dashed border-slate-300 bg-white"
        aria-label={tp("Signature")}
        data-testid="signature-pad"
      />
      <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
        <span className="inline-flex items-center gap-1"><PenLineIcon className="h-3.5 w-3.5" /> {tp("Ask the receiver to sign with a finger")}</span>
        <button type="button" onClick={() => { setup(); mark(false); }} className="rounded px-2 py-0.5 font-medium text-slate-500 hover:bg-slate-100">{tp("Clear")}</button>
      </div>
    </div>
  );
});
SignaturePad.displayName = "SignaturePad";

/** A phone photo made smaller before upload (longest side 1600 px, JPEG); the original when the browser can't read it. */
export const shrinkPhoto = async (file: File, maxSide = 1600): Promise<Blob> => {
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    URL.revokeObjectURL(url);
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    if (scale === 1 && file.size < 1_500_000 && /jpe?g|png|webp/i.test(file.type)) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    return blob ?? file;
  } catch {
    return file;
  }
};

export const MAX_PHOTOS = 5;

/** Photo picker: the camera (where the phone offers it) or the gallery, with thumbnails. */
export const PhotoPicker: React.FC<{ photos: File[]; onChange: (photos: File[]) => void }> = ({ photos, onChange }) => {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  useEffect(() => {
    const urls = photos.map((p) => URL.createObjectURL(p));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [photos]);
  const add = (list: FileList | null) => {
    if (!list) return;
    onChange([...photos, ...Array.from(list).filter((f) => f.type.startsWith("image/"))].slice(0, MAX_PHOTOS));
  };
  const full = photos.length >= MAX_PHOTOS;
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={full} onClick={() => cameraRef.current?.click()} className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 py-2.5 text-sm font-medium disabled:opacity-40 dark:border-gray-700">
          <CameraIcon className="h-4 w-4" /> {tp("Take photo")}
        </button>
        <button type="button" disabled={full} onClick={() => galleryRef.current?.click()} className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 py-2.5 text-sm font-medium disabled:opacity-40 dark:border-gray-700">
          <ImageIcon className="h-4 w-4" /> {tp("Choose photo")}
        </button>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" data-testid="photo-camera"
        onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" data-testid="photo-gallery"
        onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      <p className="mt-1 text-xs text-slate-400">{tp("Up to {n} photos", { n: MAX_PHOTOS })}</p>
      {previews.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {previews.map((src, i) => (
            <div key={src} className="relative">
              <img src={src} alt="" className="h-16 w-16 rounded-lg object-cover" />
              <button type="button" aria-label={tp("Remove photo")} onClick={() => onChange(photos.filter((_, j) => j !== i))}
                className="absolute -end-1.5 -top-1.5 rounded-full bg-slate-800 p-0.5 text-white">
                <XIcon className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
