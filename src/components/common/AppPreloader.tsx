import { useEffect, useState } from "react";

interface AppPreloaderProps {
    onFinished: () => void;
}

const AppPreloader: React.FC<AppPreloaderProps> = ({ onFinished }) => {
    const [progress, setProgress] = useState(0);
    const [fadeOut, setFadeOut] = useState(false);

    useEffect(() => {
        const steps = [15, 35, 55, 75, 90, 100];

        steps.forEach((value, index) => {
            setTimeout(() => {
                setProgress(value);
            }, index * 350);
        });

        setTimeout(() => {
            setFadeOut(true);
            setTimeout(onFinished, 500);
        }, 2600);
    }, [onFinished]);

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#ffffff",
                transition: "opacity 0.5s ease",
                opacity: fadeOut ? 0 : 1,
                pointerEvents: fadeOut ? "none" : "all",
            }}
        >
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "28px",
                    width: "280px",
                }}
            >
                {/* Logo */}
                <div
                    style={{
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    {/* Ring */}
                    <div
                        style={{
                            position: "absolute",
                            width: "84px",
                            height: "84px",
                            borderRadius: "50%",
                            border: "2px solid rgba(6,182,212,0.08)",
                        }}
                    />

                    <svg
                        width="84"
                        height="84"
                        viewBox="0 0 84 84"
                        style={{
                            position: "absolute",
                            animation: "spin 2.2s linear infinite",
                        }}
                    >
                        <circle
                            cx="42"
                            cy="42"
                            r="38"
                            fill="none"
                            stroke="#06b6d4"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeDasharray="80 180"
                        />
                    </svg>

                    <img
                        src="/images/logo/logo.png"
                        alt="My Trading"
                        style={{
                            width: "56px",
                            height: "56px",
                            objectFit: "contain",
                        }}
                    />
                </div>

                {/* Brand */}
                <div
                    style={{
                        textAlign: "center",
                    }}
                >
                    <h1
                        style={{
                            margin: 0,
                            fontSize: "28px",
                            fontWeight: 700,
                            fontFamily: "'Inter', sans-serif",
                            color: "#0f172a",
                            letterSpacing: "-0.5px",
                        }}
                    >
                        My Trading
                    </h1>

                    <p
                        style={{
                            margin: "6px 0 0",
                            fontSize: "13px",
                            color: "#64748b",
                            fontFamily: "'Inter', sans-serif",
                        }}
                    >
                        Loading workspace...
                    </p>
                </div>

                {/* Progress */}
                <div
                    style={{
                        width: "100%",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                    }}
                >
                    <div
                        style={{
                            width: "100%",
                            height: "5px",
                            borderRadius: "999px",
                            background: "#e2e8f0",
                            overflow: "hidden",
                        }}
                    >
                        <div
                            style={{
                                width: `${progress}%`,
                                height: "100%",
                                borderRadius: "999px",
                                background:
                                    "linear-gradient(90deg, #06b6d4, #0891b2)",
                                transition: "width .35s ease",
                            }}
                        />
                    </div>

                    <div
                        style={{
                            display: "flex",
                            justifyContent: "flex-end",
                        }}
                    >
                        <span
                            style={{
                                fontSize: "12px",
                                fontWeight: 600,
                                color: "#0891b2",
                                fontFamily: "'Inter', sans-serif",
                            }}
                        >
                            {progress}%
                        </span>
                    </div>
                </div>
            </div>

            <style>{`
                

                @keyframes ball {
                    0%   { transform: translate(0, 0); }
                    5%   { transform: translate(8px, -14px); }
                    10%  { transform: translate(15px, -10px); }
                    17%  { transform: translate(23px, -24px); }
                    20%  { transform: translate(30px, -20px); }
                    27%  { transform: translate(38px, -34px); }
                    30%  { transform: translate(45px, -30px); }
                    37%  { transform: translate(53px, -44px); }
                    40%  { transform: translate(60px, -40px); }
                    50%  { transform: translate(60px, 0); }
                    57%  { transform: translate(53px, -14px); }
                    60%  { transform: translate(45px, -10px); }
                    67%  { transform: translate(37px, -24px); }
                    70%  { transform: translate(30px, -20px); }
                    77%  { transform: translate(22px, -34px); }
                    80%  { transform: translate(15px, -30px); }
                    87%  { transform: translate(7px, -44px); }
                    90%  { transform: translate(0, -40px); }
                    100% { transform: translate(0, 0); }
                }
                @keyframes barUp1 {
                    0%  { transform: scale(1, .2); }
                    40% { transform: scale(1, .2); }
                    50% { transform: scale(1, 1); }
                    90% { transform: scale(1, 1); }
                    100%{ transform: scale(1, .2); }
                }
                @keyframes barUp2 {
                    0%  { transform: scale(1, .4); }
                    40% { transform: scale(1, .4); }
                    50% { transform: scale(1, .8); }
                    90% { transform: scale(1, .8); }
                    100%{ transform: scale(1, .4); }
                }
                @keyframes barUp3 {
                    0%  { transform: scale(1, .6); }
                    100%{ transform: scale(1, .6); }
                }
                @keyframes barUp4 {
                    0%  { transform: scale(1, .8); }
                    40% { transform: scale(1, .8); }
                    50% { transform: scale(1, .4); }
                    90% { transform: scale(1, .4); }
                    100%{ transform: scale(1, .8); }
                }
                @keyframes barUp5 {
                    0%  { transform: scale(1, 1); }
                    40% { transform: scale(1, 1); }
                    50% { transform: scale(1, .2); }
                    90% { transform: scale(1, .2); }
                    100%{ transform: scale(1, 1); }
                }
                @keyframes shimmer {
                    0%   { transform: translateX(-100%); }
                    100% { transform: translateX(200%); }
                }
            `}</style>
        </div>
    );
};

export default AppPreloader;