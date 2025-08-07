import StringTool from "../views/StringTool";

export default function HomePage() {
    return (
        <section className="bg-gray-100 min-h-screen">
            <div className="container mx-auto px-4 py-8">
                <h1 className="text-4xl font-bold text-center text-gray-800 mb-8">
                    Multi Tool App
                </h1>

                <div className="view-container">
                    <StringTool />
                </div>
            </div>
        </section>
    );
}