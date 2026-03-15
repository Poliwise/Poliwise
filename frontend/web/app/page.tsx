import LoadingScreen from "@/components/ui/loading/LoadingScreen";

export default function Home() {
  return (
    <div className="">
      <LoadingScreen
        imageSrc="/images/Poliwise-user.png"
        text="Đang tải..."
        imageSize={200}
      />
    </div>
  );
}
