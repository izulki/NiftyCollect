var axios = require('axios');
var { pool, db } = require('../utils/DBPool')
var pgp = require('pg-promise')({
    capSQL: true
});

interface setToEvaluate {
    id: String,
    flowName: String
}

interface TSMomentMeta {
    id: string;
    setid: string;
    playid: string;
    league: string;
    pricemin: number;
    pricemax: number;
    burned: number;
    circulation: number;
    noforsale: number;
    hidden: number;
    owned: number;
    unavailable: number;
    averageprice: number;
    averagedays: number;
    numsales: number;
}


async function TSMonitorCurrentPrice() {
    const cs = new pgp.helpers.ColumnSet(['id', 'setid', 'playid', 'league', 'pricemin', 'pricemax', 'burned', 'circulation',
    'noforsale', 'hidden', 'owned', 'unavailable', 'averageprice', 'averagedays', 'numsales'], {table: 'TSEditionMeta'});

    let setsToEvaluate: setToEvaluate[];
    setsToEvaluate = [];

    try {
        let res = await pool.query(`SELECT id, "flowName" FROM public."TSSets";`)
        setsToEvaluate = [...res.rows]
    } catch (err) {
        console.log(err)
    }

    for (let i = 0; i < setsToEvaluate.length; i++) {
        console.log(`---${Date.now()}: FETCHING PRICE FOR - ${setsToEvaluate[i].flowName}---`)
        let momentsInSet: TSMomentMeta[];
        momentsInSet = [];
        try {
            let config = generatePriceConfig(setsToEvaluate[i].id, "")
            let gqlResponse = await axios(config);
            let rightCursor = gqlResponse.data.data.searchEditionListings.data.searchSummary.pagination.rightCursor;
            let size = gqlResponse.data.data.searchEditionListings.data.searchSummary.data.size
            let editions = gqlResponse.data.data.searchEditionListings.data.searchSummary.data.data;
        
            while (rightCursor) {
                for (let j=0; j < editions.length; j++) {
                    let currentMoment: TSMomentMeta = {
                        id: editions[j].id,
                        setid: editions[j].set.id,
                        playid: editions[j].play.id,
                        league: editions[j].play.league,
                        pricemin: parseFloat(editions[j].priceRange.min),
                        pricemax: parseFloat(editions[j].priceRange.max), 
                        burned: editions[j].setPlay.circulations.burned,
                        circulation: editions[j].setPlay.circulations.circulationCount,
                        noforsale: editions[j].setPlay.circulations.forSaleByCollectors,
                        hidden: editions[j].setPlay.circulations.hiddenInPacks,
                        owned: editions[j].setPlay.circulations.ownedByCollectors,
                        unavailable: editions[j].setPlay.circulations.unavailableForPurchase,
                        averageprice: parseFloat(editions[j].averageSaleData.averagePrice),
                        averagedays:  editions[j].averageSaleData.numDays,
                        numsales: editions[j].averageSaleData.numSales
                    }
                 momentsInSet.push(currentMoment) 
                 //console.log(editions[j].id)
                }
                let configPaged = generatePriceConfig(setsToEvaluate[i].id, rightCursor)
                let gqlResponsePaged = await axios(configPaged);
                editions = gqlResponsePaged.data.data.searchEditionListings.data.searchSummary.data.data;
                rightCursor = gqlResponsePaged.data.data.searchEditionListings.data.searchSummary.pagination.rightCursor;
                size = size + gqlResponsePaged.data.data.searchEditionListings.data.searchSummary.data.size;
            }

            // UPSERT SET TO DATABASE
            const uniq = [...new Map(momentsInSet.map(v => [v.id, v])).values()]
            const onConflictEditionMeta = ' ON CONFLICT(id) DO UPDATE SET ' +
            cs.assignColumns({from: 'EXCLUDED', skip: ['id']});
            const massInsertEditionMeta = pgp.helpers.insert(uniq, cs) + onConflictEditionMeta;
            console.log(`---${Date.now()}: UPLOADING TO TSEditionMeta: ${setsToEvaluate[i].flowName}---`)
            try {
                await db.none(massInsertEditionMeta);
            } catch (e) {
                console.log(e)
            }
        } catch (err) {
                console.log(err)
        }

    }

}

TSMonitorCurrentPrice()


function generatePriceConfig(set: String, cursor: String): Object {
    let data = JSON.stringify({
        query: `query SearchEditionListingsDefault($bySets: [ID], $byLeagues: [League], $byPlayers: [ID], $byTeams: [ID], $byPrimaryPlayerPosition: [PlayerPosition], $byPlayCategory: [ID], $byPrice: PriceRangeFilterInput, $bySerialNumber: IntegerRangeFilterInput, $byGameDate: DateRangeFilterInput, $byCreatedAt: DateRangeFilterInput, $bySetVisuals: [VisualIdType], $byPlayTagIDs: [ID], $byPlayIDs: [ID], $bySetPlayTagIDs: [ID], $bySeries: [ID], $byActiveChallenge: [ID], $orderBy: EditionListingSortType, $searchInput: BaseSearchInput!, $userID: ID) {
        searchEditionListings(input: {filters: {bySets: $bySets, byLeagues: $byLeagues, byPlayers: $byPlayers, byTeams: $byTeams, byPrimaryPlayerPosition: $byPrimaryPlayerPosition, byPlayCategory: $byPlayCategory, byPrice: $byPrice, bySerialNumber: $bySerialNumber, byGameDate: $byGameDate, byCreatedAt: $byCreatedAt, bySetVisuals: $bySetVisuals, byPlayTagIDs: $byPlayTagIDs, byPlayIDs: $byPlayIDs, bySetPlayTagIDs: $bySetPlayTagIDs, bySeries: $bySeries, byActiveChallenge: $byActiveChallenge}, sortBy: $orderBy, searchInput: $searchInput, userID: $userID}) {
          data {
            filters {
              bySets
              byLeagues
              byPlayers
              byTeams
              byPrimaryPlayerPosition
              byPlayCategory
              byPrice {
                min
                max
                __typename
              }
              bySerialNumber {
                min
                max
                __typename
              }
              byGameDate {
                start
                end
                __typename
              }
              byCreatedAt {
                start
                end
                __typename
              }
              bySetVisuals
              byPlayIDs
              byPlayTagIDs
              bySetPlayTagIDs
              bySeries
              byActiveChallenge
              __typename
            }
            searchSummary {
              pagination {
                leftCursor
                rightCursor
                __typename
              }
              data {
                ... on EditionListings {
                  size
                  data {
                    ... on EditionListing {
                      ...EditionFragment
                      __typename
                    }
                    __typename
                  }
                  __typename
                }
                __typename
              }
              __typename
            }
            __typename
          }
          __typename
        }
      }
      
      fragment EditionFragment on EditionListing {
        id
        version
        assetPathPrefix
        set {
          id
        }
        play {
          id
          tags {
            ...TagsFragment
            __typename
          }
          league
          __typename
        }
        setPlay {
          ID
          flowRetired
          tags {
            ...TagsFragment
            __typename
          }
          circulations {
            ...CirculationsFragment
            __typename
          }
          __typename
        }
        priceRange {
          min
          max
          __typename
        }
        uniqueSellerCount
        editionListingCount
        userOwnedEditionsCount
        averageSaleData {
          averagePrice
          numDays
          numSales
          __typename
        }
        __typename
      }
      
      fragment TagsFragment on Tag {
        id
        title
        visible
        level
        __typename
      }
      
      fragment CirculationsFragment on SetPlayCirculations {
        burned
        circulationCount
        forSaleByCollectors
        hiddenInPacks
        ownedByCollectors
        unavailableForPurchase
        __typename
      }`,
        variables: { 
            "byPrice": { "min": null, "max": null }, 
            "byGameDate": { "start": null, "end": null }, 
            "byCreatedAt": { "start": null, "end": null }, 
            "byPrimaryPlayerPosition": [], 
            "byPlayCategory": [], 
            "byActiveChallenge": [], 
            "bySets": [`${set}`], 
            "bySeries": [], 
            "bySetVisuals": [], 
            "byLeagues": [], 
            "byPlayers": [], 
            "byPlayTagIDs": [], 
            "bySetPlayTagIDs": [], 
            "byTeams": [], 
            "byPlayIDs": [], 
            "searchInput": { "pagination": { "cursor": `${cursor}`, "direction": "RIGHT", "limit": 20 } }, 
            "orderBy": "UPDATED_AT_DESC", 
            "userID": "" }
    });

    return {
        method: 'post',
        url: 'https://api.nba.dapperlabs.com/marketplace/graphql',
        headers: {
            'Content-Type': 'application/json'
        },
        data: data
    };
}