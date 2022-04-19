/*** --- IMPORT LIBRARIES --- ***/
var axios = require('axios');
var {pool, db} = require('../utils/DBPool')
var pgp = require('pg-promise')({
    capSQL: true 
  });

interface setToEvaluate {
    id: String,
    flowName: String
}

interface TSEdition {
    id: string;
    setid: string;
    playid: string;
    playerid: string;
    playername: string;
    playcategory: string;
    dateofmoment: string;
    assetpath: string;
  }

async function TSMonitorPlays() {
    const cs = new pgp.helpers.ColumnSet(['id', 'setid', 'playid', 'playerid', 'playername', 'playcategory', 'dateofmoment', 'assetpath'], {table: 'TSEditions'});
    let values: TSEdition[];
    values = [];
    let setsToEvaluate: setToEvaluate[];
    setsToEvaluate = [];

    try {
        let res = await pool.query(`SELECT id, "flowName" FROM public."TSSets";`)
        setsToEvaluate = [...res.rows]
    } catch (err) {
        console.log(err)
    }

    for (let i=0; i<setsToEvaluate.length; i++) {
        console.log(`---${Date.now()}: FETCHING PLAYS - ${setsToEvaluate[i].flowName}---`)
        try {
            let config = generatePlaysConfig(setsToEvaluate[i].id)
            let gqlResponse = await axios(config);
            let plays = gqlResponse.data.data.getCodexSet.codexSetWithEditions.editionSlots;
            //console.log(plays)
            for (let j=0; j<plays.length; j++) {
                const currentPlay: TSEdition = {
                    id: plays[j].edition.id,
                    setid: plays[j].edition.set.id,
                    playid: plays[j].edition.play.id,
                    playerid: plays[j].edition.play.stats.playerID,
                    playername: plays[j].edition.play.stats.playerName,
                    playcategory: plays[j].edition.play.stats.playCategory,
                    dateofmoment: plays[j].edition.play.stats.dateOfMoment,
                    assetpath: plays[j].edition.assetPathPrefix
                  }               
                  values.push(currentPlay)
            }
        } catch (err) {
            console.log(err)
        }
    }

    console.log(`---${Date.now()}: DELETING FROM TSSets---`)
    try {
        let res = await pool.query(`DELETE FROM public."TSEditions";`)
    } catch (err) {
        console.log(err)
    }
    console.log(`---${Date.now()}: UPLOADING TO TSSets---`)
    const massInsertPlays = pgp.helpers.insert(values, cs);
    try {
        await db.none(massInsertPlays);
    } catch (e) {
        console.log(e)
    }
}

TSMonitorPlays();


function generatePlaysConfig(set: String): Object {
    var playsQuery = JSON.stringify({
        query: `query GetCodexSet($input: GetCodexSetInput!) {
          getCodexSet(input: $input) {
            codexSetWithEditions {
              codexSet {
                set {
                  id
                  flowName
                  assetPath
                  flowLocked
                  setVisualId
                  __typename
                }
                totalEditionSlots
                filledEditionSlots
                uniqueMoments
                hasChallengeReward
                __typename
              }
              editionSlots {
                edition {
                  id
                  set {
                    id
                    flowName
                    flowLocked
                    flowSeriesNumber
                    assetPath
                    __typename
                  }
                  play {
                    id
                    stats {
                      playerID
                      playerName
                      playCategory
                      dateOfMoment
                      __typename
                    }
                    __typename
                  }
                  circulationCount
                  flowRetired
                  assetPathPrefix
                  state
                  challengeID
                  __typename
                }
                filledMomentIDs
                __typename
              }
              __typename
            }
            __typename
          }
        }`,
        variables: {"input":{"setID":set}}
      });

      var config = {
        method: 'post',
        url: 'https://api.nba.dapperlabs.com/marketplace/graphql',
        headers: { 
          'Content-Type': 'application/json'
        },
        data : playsQuery
      };

      return config
}