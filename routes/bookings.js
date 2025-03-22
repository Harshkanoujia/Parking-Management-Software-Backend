const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const { Booking } = require('../model/Booking');
const { Vehicle } = require('../model/Vehicle');
const { ParkingSlot } = require('../model/ParkingSlot');
const { ParkingSpot } = require('../model/ParkingSpot');


// User can book a slot
router.post('/', async (req, res) => {                                                          

    if (!mongoose.Types.ObjectId.isValid(req.body.parkingAreaId)) {
        return res.status(400).json({ msg: 'Invalid Parking ID !' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.body.vehicleId)) {
        return res.status(400).json({ msg: 'Invalid Vehicle ID !' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.body.userId)) {
        return res.status(400).json({ msg: 'Invalid User ID !' });
    }

    const checkAreaId = await ParkingSlot.findOne({ parkingAreaId: req.body.parkingAreaId}).populate('parkingAreaId')
    if (!checkAreaId) return res.status(400).json({ msg: 'Parking Area Id not Found'})
    
    const checkSpot = await ParkingSpot.findOne({ parkingSlotId: checkAreaId._id, isBooked: false})
    if (!checkSpot)  return res.status(400).json({ msg: 'No Spot Left'})
    
    vehicleAllowed = checkAreaId.parkingAreaId.allowedVehicle
    
    const checkUserId = await Vehicle.find({ ownerId: req.body.userId, vehicleType: vehicleAllowed })//.populate('ownerId')
    if (!checkUserId || checkUserId.length === 0) {
        return res.status(400).json({ msg: `User Id not Found or Your Vehicle is not allowed in this Parking. !Choose Different area. In this Parking only ${vehicleAllowed} is allowed`});
    }
    
    remainingSlot = checkAreaId.remainingSlots
    area = checkAreaId.parkingAreaId.area
    
    if (remainingSlot === 0){
        res.status(400).json({msg: 'No slots are available. Check Different Area !!'})
    }
    
    const booking = new Booking({                                                                                                                                                   // slotsNeed: req.body.slotsNeed,
        userId: req.body.userId,
        vehicleId: req.body.vehicleId,
        parkingAreaId: req.body.parkingAreaId,                                               
        // status: req.body.status,                                         
        days: req.body.days * 60 * 60 * 24 || 0,
        hours: req.body.hours * 60 * 60  || 0,
        spotNo: checkSpot.spotNo         
    })
    await booking.save()
            
    await ParkingSlot.updateOne(
        { parkingAreaId: req.body.parkingAreaId },                                                                                                                                    // { $set: { remainingSlots: remainingSlot - req.body.slotsNeed }}
        { $set: { remainingSlots: --remainingSlot } }
    )
    
    await ParkingSpot.updateOne(
        { _id: checkSpot._id },        
        { $set: {
                isBooked: true,
                bookedBy: req.body.userId,
                vehicleType: req.body.vehicleId,
                bookedDate: booking.bookingDate
            }
        }
    )
    return res.status(200).json({msg: 'Succesfully Booking', bookingData : booking })

});

// User can complete its booking
router.post('/complete', async (req, res) => {                                                  

    if (!mongoose.Types.ObjectId.isValid(req.body.bookingId)){
        return res.status(400).json({msg: 'Invalid Booking Id'})
    }
    
    const checkBooking = await Booking.findOne({ _id: req.body.bookingId})
    if (!checkBooking || checkBooking.status === 'complete' ){
        return res.status(400).json({ msg: 'Id Not found or Invalid request. Booking already complete !'})
    }    
    
    const checkAreaId = await ParkingSlot.findOne({ parkingAreaId: checkBooking.parkingAreaId})
    if (!checkAreaId)   return res.status(400).json({ msg: 'Slot Not Found !'})
    
    const checkSpot = await ParkingSpot.findOne({ spotNo: checkBooking.spotNo , bookedBy: checkBooking.userId})
    
    let remainingSlot  = checkAreaId.remainingSlots
    const totalSlot = checkAreaId.totalSlots
    
    if ( totalSlot ===  remainingSlot ){
        return res.status(400).json({ msg: 'Invalid request'})
    }

    const updateBooking = await Booking.updateOne( 
        {_id: checkBooking},
        { $set: { status: 'complete'} }
    )
    
    await ParkingSlot.updateOne( 
        { parkingAreaId: checkBooking.parkingAreaId },
        { $set: { remainingSlots: ++remainingSlot } }                                                                                                       //{ $set: { remainingSlots: remainingSlot + checkBooking.slotsBooked} }
    )
    
    await ParkingSpot.updateOne(
        { spotNo: checkBooking.spotNo, _id: checkSpot._id },
        {
            $set: {
                isBooked: false,
                bookedBy: null,
                vehicleType: null,
                bookedDate: null
            }
        }
    )
    
    res.status(200).json({ 'Booking Complete': updateBooking })    
});

// All bookings
router.get('/', async (req, res) => {                                                           

    // const booking = await Booking.find()//.populate('parkingAreaId').populate('vehicleId')           //.populate('userId')
        
    const booking = await Booking.aggregate([ 
        {
            $match: {}
        },
        {
            $lookup:{
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'UserDetails'
            }
        },
        {
            $lookup:{
                from: 'parkingareas',
                localField: 'parkingAreaId',
                foreignField: '_id',
                as: 'ParkingDetails'
            }
        }
    ])      
    if (booking.length === 0)   return res.status(400).json({ msg: 'No Booking Found !'})
    
    res.status(200).json({"Bookings": booking })
});

// check user booking details with userId
router.get('/user', async (req, res) => {
    
    if (!mongoose.Types.ObjectId.isValid(req.query.userId)) {
        return res.status(400).json('It work')
    }

    const userBooking = await Booking.aggregate([
        {
            $match: { 
                userId: new mongoose.Types.ObjectId(req.query.userId),
                status: { $ne: "complete"}
            },
            
        },
        {
            $sort: { spotNo : 1 }
        },
        {
            $limit: 2
        },
        {   
            $lookup: {
                from: "vehicles",
                localField: "vehicleId",
                foreignField: "_id",
                as: "Vehicle",
                pipeline : [
                    {
                        $lookup: {
                            from: "users",
                            localField: "ownerId",
                            foreignField: "_id",
                            as: "User Profile",
                        }
                    }
                ]
            }
        },
        {
            $lookup: {
                from: "parkingareas",
                localField: "parkingAreaId",
                foreignField: "_id",
                as: "Parking Area",
                pipeline: [
                    {
                        $lookup: {
                            from: 'admins',
                            localField: 'createdBy',
                            foreignField: '_id',
                            as: 'Owner',
                        },
                    },
                ],
            }
        },
        {
            $project: {
                _id: 0,
                userId: 0,
                vehicleId: 0,
                parkingAreaId: 0,
                status: 0,
                "Parking Area.creationDate": 0,
                "Parking Area._id": 0,
                "Parking Area.Owner._id": 0,
                "Parking Area.Owner.password": 0,
                "Parking Area.Owner.creationDate": 0,
                "Parking Area.Owner.token": 0,
                "Vehicle._id": 0,
                "Vehicle.creationDate": 0,
                "Vehicle.ownerId": 0,
                "Vehicle.User Profile._id": 0,
                "Vehicle.User Profile.password": 0,
                "Vehicle.User Profile.token": 0,
                "Vehicle.User Profile.creationDate": 0,
                "Vehicle.__v": 0,
                "Vehicle.User Profile.__v": 0,
                "Parking Area.__v": 0,
                "Parking Area.Owner.__v": 0,
                __v:0,
            }
        }
    ])
    if (! userBooking  || userBooking.length === 0 )  return res.status(400).json({ statuscode: 400, message: "Faliure", data: { message: "UserId Not found"}})

    return res.status(200).json({ statuscode: 200, message: "Success", data: { "The Active booking is ": userBooking }})
});

// check user booking details with userId with more details 
router.get('/user/history', async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.query.userId)) {
        return res.status(400).json( { statuscode: 400, message: "Faliure", data: { message:'Invalid Id'} })
    }

    const userBooking = await Booking.aggregate([
        {
            $match: { userId: new mongoose.Types.ObjectId(req.query.userId) }
        },
        {
            $lookup: {
                from: "users",
                localField: "userId",
                foreignField: "_id",
                as: "User",
            }
        },
        {
            "$lookup": {
                "from": "parkingareas",
                "localField": "parkingAreaId",
                "foreignField": "_id",
                "as": "Parking Area"
            }
        },
        {   $unwind: "$User"  },
        {   $unwind: "$Parking Area"  },
        {
            $addFields: { 
                "User.userTimestamp": { $toDate : "$User.creationDate"},
                timestamp: { $toDate : "$bookingDate"}
            }
        },
        {
            $addFields: {
                "User.creationDateString": {
                    $dateToString: {
                        format: "%Y-%m-%d %H:%M:%S",
                        date: "$User.userTimestamp",
                        // timezone: "Asia/Kolkata"             // Adjust to your timezone
                    },
                },
                creationDateString: {
                    $dateToString: {
                        format: "%Y-%m-%d %H:%M:%S",            // Customize format as needed
                        date: "$timestamp",
                        // timezone: "Asia/Kolkata"             // Optional: Set your timezone
                    }
                }
            }
        },
        {
            $group: {
                _id: "$user._id",
                user: { 
                    // $first: "$User"
                    $first:{
                        username: "$User.username",
                        email: "$User.email",
                        mobile: "$User.mobile",
                        role: "$User.role",
                        creationDate: "$User.creationDateString"          // Formatted user creation date
                    }
                },
                parkingArea: { $first: "$Parking Area"},
                bookingHistory: {
                    $push: {
                        vehicleId: "$vehicleId",
                        status: "$status",
                        spotNo: "$spotNo",
                        days: "$days",
                        hours: "$hours",
                        bookingDate: "$creationDateString",
                    }
                }
            }
        },
        {
            $project: {
                _id: 0,
                userId: 0,
                "user._id": 0,
                "user.token": 0,
                "user.password": 0,
                "parkingArea.creationDate": 0,
                "parkingArea._id": 0,
                "parkingArea.__v": 0,
                __v:0,
            }
        }
    ])
    if (! userBooking )  return res.status(400).json({ statuscode: 400, message: "Faliure", data: { message: "UserId Not found"}})

    return res.status(200).json({ statuscode: 200, message: "Success", data: { "Your Booking History is ": userBooking } })
});

// Booking find by Id
router.get('/:id', async ( req , res) => {   

    if (! mongoose.Types.ObjectId.isValid(req.params.id)){
        return res.status(400).json('Invalid Id')
    }

    const booking = await Booking.aggregate([
        { 
            $match: {
             _id: new mongoose.Types.ObjectId( req.params.id ) 
            }
        },
        {
            $lookup: {
              from: "users",                                                        // refer to collection join karna hai
              localField: "userId",                                                 // `booking` collection field
              foreignField: "_id",                                                  // `user` collection ka field
              as: "userDetails"                                                     // Result 
            }
        },
        {
            $lookup: {
              from: "parkingareas",                                                        
              localField: "parkingAreaId",                                                
              foreignField: "_id",                                                 
              as: "Area"                                                     
            }
        },
    ])
    if (!booking) return res.status(400).json({msg: "ID not found"})
    
    res.status(200).json({Booking: booking }) 
});

module.exports = router;