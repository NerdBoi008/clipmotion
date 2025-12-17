import Image from "next/image";
import { cn } from "@/lib/utils";

const ToggleImg = ({
  from,
  to,
  isDark,
}: {
  from: string;
  to: string;
  isDark: boolean;
}) => {
  return (
    <div className="relative w-full h-64 overflow-hidden">
      {/* Base Image */}
      <Image
        src={from}
        alt="Image From"
        fill
        style={{ objectFit: "cover" }}
        className={cn(
          "transition-opacity duration-700 ease-in-out",
          isDark ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Toggled Image */}
      <Image
        src={to}
        alt="Image To"
        fill
        style={{ objectFit: "cover" }}
        className={cn(
          "transition-opacity duration-700 ease-in-out absolute inset-0",
          isDark ? "opacity-0" : "opacity-100"
        )}
      />
    </div>
  );
};

export default ToggleImg;