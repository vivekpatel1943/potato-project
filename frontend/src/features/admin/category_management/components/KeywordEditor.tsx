import React, { useState } from 'react';

interface KeywordEditorProps {
  keywords: string[];
  onKeywordsChange: (keywords: string[]) => void;
}

export const KeywordEditor: React.FC<KeywordEditorProps> = ({ keywords = [], onKeywordsChange }) => {
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newKeyword = inputValue.trim().toLowerCase();

      if (newKeyword && !keywords.includes(newKeyword)) {
        const updatedKeywords = [...keywords, newKeyword];
        onKeywordsChange(updatedKeywords);
      }
      setInputValue("");
    }
  };

  const removeKeyword = (keywordToRemove: string) => {
    const updatedKeywords = keywords.filter(k => k !== keywordToRemove);
    onKeywordsChange(updatedKeywords);
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Search Keywords (Press Enter or Comma to add)
      </label>

      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="e.g. 'roti sabji', 'ac repair'..."
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="flex flex-wrap gap-2 mt-3">
        {keywords.map((keyword, index) => (
          <span
            key={index}
            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
          >
            {keyword}
            <button
              type="button"
              onClick={() => removeKeyword(keyword)}
              className="ml-2 inline-flex text-blue-400 hover:text-blue-600 focus:outline-none"
            >
              &times;
            </button>
          </span>
        ))}
        {keywords.length === 0 && (
          <span className="text-sm text-gray-500 italic">No keywords added yet.</span>
        )}
      </div>
    </div>
  );
};
