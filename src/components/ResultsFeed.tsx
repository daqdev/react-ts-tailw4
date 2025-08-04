export default function ResultsFeed({ parsedData }) {
    return (
        <div className="flow-root">
            <ul className="-my-8 divide-y divide-gray-100 mt-0.5" >
                {parsedData.map((item, index) => (
                    <li key={index} className="py-0.1">
                        <div className="flex items-center gap-4">
                            <span className="text-xs rounded-full bg-gray-100 p-0 text-gray-600">
                                #{index + 1}
                            </span>
                            <div>
                                <p className="font-light font-mono text-sm text-gray-900">{item}</p>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
