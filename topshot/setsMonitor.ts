
/*** --- IMPORT LIBRARIES --- ***/
var axios = require('axios');
var {pool} = require('../utils/DBPool')

/*** --- CONSTANTS & GLOBALS --- ***/
const setSeries = ["SERIES_1", "SERIES_2", "SERIES_3", "SERIES_S2021"]

interface TSSet {
  id: string;
  flowId: number;
  flowName: string;
  flowLocked: boolean;
  assetPath: string;
  setVisualId: string;
  flowSeriesNumber: number;
  totalEditionSlots: number;
}

/*** --- MONITOR FUNCTION  --- ***/
async function TSMonitorSets() {
  console.log(`--- ${Date.now()}: STARTING TS SETS MONITOR ---`)
  while (1) {
    console.log(`--- ${Date.now()}: RUNNING CURRENT RUN ---`)
    /*** --- SET UP AXIOS QUERY - ITERATE THROUGH SERIES --- ***/
    for (let seriesIterator = 0; seriesIterator < setSeries.length; seriesIterator++) {
      var data = JSON.stringify({
        query: `query GetCodex($input: GetCodexInput!) {
          getCodex(input: $input) {
            codex {
              set {
                id
                flowId
                flowName
                flowLocked
                assetPath
                setVisualId
                flowSeriesNumber
                __typename
              }
              totalEditionSlots
              filledEditionSlots
              uniqueMoments
              hasChallengeReward
              __typename
            }
            numSetsInProgress
            numSetsCompleted
            totalUserOwnedMoments
            totalUniqueEditionsOwned
            __typename
          }
        }`,
        variables: { "input": { "filters": { "bySeries": `${setSeries[seriesIterator]}` } } }
      });

      //CONFIG
      var config = {
        method: 'post',
        url: 'https://api.nba.dapperlabs.com/marketplace/graphql',
        headers: {
          'Content-Type': 'application/json'
        },
        data: data
      };

      /*** --- EXECUTE QUERY --- ***/
      try {
        console.log(`--- ${Date.now()}: Evaluating ${setSeries[seriesIterator]} ---`)
        const response = await axios(config);
        let setArray = response.data.data.getCodex.codex;
        //console.log(` - Series ${setSeries[seriesIterator]}: ${setArray.length} sets`)
        /*** --- PARSE RESPONSE AND SAVE --- ***/
        for (let i = 0; i < setArray.length; i++) {
          const currentSet: TSSet = {
            id: setArray[i].set.id,
            flowId: setArray[i].set.flowId,
            flowName: setArray[i].set.flowName,
            flowLocked: setArray[i].set.flowLocked,
            assetPath: setArray[i].set.assetPath,
            setVisualId: setArray[i].set.setVisualId,
            flowSeriesNumber: setArray[i].set.flowSeriesNumber,
            totalEditionSlots: setArray[i].totalEditionSlots,
          }
          //console.log(` - ${setSeries[seriesIterator]}: ${currentSet.flowName} (${Date.now()})`)
          try {
            let resp = await TSUpsertSetToDB(currentSet)
          } catch (err) {
            console.log(err)
          }
          //console.log(currentSet)
        }
      }
      catch (err) {
        console.error(err)
      }
    }
    console.log(`--- ${Date.now()}: Completed current sets search - 3 hours until next run ---`)
    await new Promise((r) => setTimeout(r, 10800000)); //Delay by 3 hours
  }
}

/*** --- FUNCTION: UPSERT SET TO DATABASE --- ***/

async function TSUpsertSetToDB(set: TSSet) {
  try {
    let res = await pool.query(`
    INSERT INTO public."TSSets"(
      id, "flowId", "flowName", "flowLocked", "assetPath", "setVisualId", "flowSeriesNumber", "totalEditionSlots")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING;
    `,
      [
        set.id,
        set.flowId,
        set.flowName,
        set.flowLocked,
        set.assetPath,
        set.setVisualId,
        set.flowSeriesNumber,
        set.totalEditionSlots
      ])
    return res
  } catch (err) {
    console.log(err)
  }
}

/*** --- RUN MONITOR --- ***/
TSMonitorSets();
