# quizUpScraper
Capture questions from your quizUp records

## Prepare
npm install

## Configure
Use config.json to include your settings.
{
	"user":"Your quizUp username",
	"firefoxProfilePath": "Your firefox profile path",
	"output": "Output path for the files",
	"urls":{
		"history": "Url to get game history (Fixed)",
		"games": "Prefix url for games (Fixed)"
		},
	"actions": {
		"getGameHistory": "True if you want to get game history",
		"getGames": "True if you want to get games information",
		"getQuestions": "True if you want to extract questions from games info"
	}
}

## Execute
node quizUpScraper.js
