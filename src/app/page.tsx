import Image from "next/image";
import LiveID from "@/components/LiveIDE.jsx";
import LiveIDE2 from "@/components/LiveIDE2.jsx";
import LiveIDEbyGem from "@/components/LiveIDEbyGem.jsx";
export default function Home() {
  return (
    <div>
      {/* <h1>Hello World</h1> */}
      {/* <LiveID /> */}
      {/* <LiveIDE2 /> */}
      <LiveIDEbyGem />
    </div>
  );
}
