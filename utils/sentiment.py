from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

analyzer = SentimentIntensityAnalyzer()
sentiment_stats = {"Happy": 0, "Sad": 0, "Angry": 0, "Neutral": 0}

def categorize_sentiment(text: str) -> str:
    score = analyzer.polarity_scores(text)
    compound = score["compound"]
    if compound > 0.5:
        return "Happy"
    elif compound < -0.5:
        if any(word in text.lower() for word in ["hate", "rage", "furious", "angry"]):
            return "Angry"
        return "Sad"
    return "Neutral"
