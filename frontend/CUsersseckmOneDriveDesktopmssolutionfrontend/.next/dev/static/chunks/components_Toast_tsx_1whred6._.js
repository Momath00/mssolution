(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/components/Toast.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "afficherToast",
    ()=>afficherToast,
    "default",
    ()=>ToastHost
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
let emettre = null;
function afficherToast(texte, type = 'succes') {
    emettre?.(texte, type);
}
function ToastHost() {
    _s();
    const [toasts, setToasts] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ToastHost.useEffect": ()=>{
            emettre = ({
                "ToastHost.useEffect": (texte, type)=>{
                    const id = Date.now() + Math.random();
                    setToasts({
                        "ToastHost.useEffect": (prev)=>[
                                ...prev,
                                {
                                    id,
                                    texte,
                                    type
                                }
                            ]
                    }["ToastHost.useEffect"]);
                    setTimeout({
                        "ToastHost.useEffect": ()=>{
                            setToasts({
                                "ToastHost.useEffect": (prev)=>prev.filter({
                                        "ToastHost.useEffect": (t)=>t.id !== id
                                    }["ToastHost.useEffect"])
                            }["ToastHost.useEffect"]);
                        }
                    }["ToastHost.useEffect"], 4000);
                }
            })["ToastHost.useEffect"];
            return ({
                "ToastHost.useEffect": ()=>{
                    emettre = null;
                }
            })["ToastHost.useEffect"];
        }
    }["ToastHost.useEffect"], []);
    if (toasts.length === 0) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col gap-2",
        children: toasts.map((t)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                role: "status",
                className: `animate-toast-in rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lg ${t.type === 'succes' ? 'bg-navy' : 'bg-red-600'}`,
                children: t.texte
            }, t.id, false, {
                fileName: "[project]/components/Toast.tsx",
                lineNumber: 38,
                columnNumber: 9
            }, this))
    }, void 0, false, {
        fileName: "[project]/components/Toast.tsx",
        lineNumber: 36,
        columnNumber: 5
    }, this);
}
_s(ToastHost, "oL0MrtDCqig+amxuKH2EOlnBcjg=");
_c = ToastHost;
var _c;
__turbopack_context__.k.register(_c, "ToastHost");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=components_Toast_tsx_1whred6._.js.map