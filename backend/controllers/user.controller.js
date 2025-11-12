import { User } from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import getDataUri from "../utils/datauri.js";
import cloudinary from "../utils/cloudinary.js";

// import cloudinary from "../config/cloudinary.js";
// import getDataUri from "../utils/datauri.js";
// import bcrypt from "bcryptjs";
// import User from "../models/user.model.js"; // update path if different

export const register = async (req, res) => {
  try {
    const { fullname, email, phoneNumber, password, role } = req.body;

    // 🧩 1. Validate required fields
    if (!fullname || !email || !phoneNumber || !password || !role) {
      return res.status(400).json({
        message: "Something is missing",
        success: false,
      });
    }

    // 🧩 2. Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: "User already exists with this email.",
        success: false,
      });
    }

    // 🧩 3. Handle file upload safely
    let profilePhotoUrl = "";
    if (req.file) {
      const fileUri = getDataUri(req.file);
const cloudResponse = await cloudinary.uploader.upload(fileUri.content, {
  resource_type: "auto",
});
      profilePhotoUrl = cloudResponse.secure_url;
    }

    // 🧩 4. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 🧩 5. Create new user
    await User.create({
      fullname,
      email,
      phoneNumber,
      password: hashedPassword,
      role,
      profile: {
        profilePhoto: profilePhotoUrl,
      },
    });

    // 🧩 6. Success response
    return res.status(201).json({
      message: "Account created successfully.",
      success: true,
    });
  } catch (error) {
    console.error("Register Error:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      success: false,
    });
  }
};

export const login = async (req, res) => {
    try {
        const { email, password, role } = req.body;
        
        if (!email || !password || !role) {
            return res.status(400).json({
                message: "Something is missing",
                success: false
            });
        };
        let user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({
                message: "Incorrect email or password.",
                success: false,
            })
        }
        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) {
            return res.status(400).json({
                message: "Incorrect email or password.",
                success: false,
            })
        };
        // check role is correct or not
        if (role !== user.role) {
            return res.status(400).json({
                message: "Account doesn't exist with current role.",
                success: false
            })
        };

        const tokenData = {
            userId: user._id
        }
        const token = await jwt.sign(tokenData, process.env.SECRET_KEY, { expiresIn: '1d' });

        user = {
            _id: user._id,
            fullname: user.fullname,
            email: user.email,
            phoneNumber: user.phoneNumber,
            role: user.role,
            profile: user.profile
        }

        return res.status(200).cookie("token", token, { maxAge: 1 * 24 * 60 * 60 * 1000, httpsOnly: true, sameSite: 'strict' }).json({
            message: `Welcome back ${user.fullname}`,
            user,
            success: true
        })
    } catch (error) {
        console.log(error);
    }
}
export const logout = async (req, res) => {
    try {
        return res.status(200).cookie("token", "", { maxAge: 0 }).json({
            message: "Logged out successfully.",
            success: true
        })
    } catch (error) {
        console.log(error);
    }
}
export const updateProfile = async (req, res) => {
  try {
    const { fullname, email, phoneNumber, bio, skills } = req.body;
    const file = req.file;

    // 1️⃣ Get logged-in user
    const userId = req.id; // from auth middleware
    let user = await User.findById(userId);

    if (!user) {
      return res.status(400).json({
        message: "User not found.",
        success: false,
      });
    }

    // 2️⃣ Handle skills
    let skillsArray;
    if (skills) {
      skillsArray = skills.split(",");
      user.profile.skills = skillsArray;
    }

    // 3️⃣ Update normal text fields
    if (fullname) user.fullname = fullname;
    if (email) user.email = email;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (bio) user.profile.bio = bio;

    // 4️⃣ Handle file upload (if any)
    if (file) {
      const fileUri = getDataUri(file);
      console.log("File type:", file.mimetype);

      // ✅ Use 'raw' for PDFs to get proper URL path
      const cloudResponse = await cloudinary.uploader.upload(fileUri.content, {
        resource_type: "raw", // This ensures /raw/upload/ path for PDFs
        folder: "resumes",
      });

      // ✅ Store the secure_url (will have /raw/upload/ path)
      user.profile.resume = cloudResponse.secure_url;
      user.profile.resumeOriginalName = file.originalname;
      
      console.log("Uploaded resume URL:", cloudResponse.secure_url);
    }

    // 5️⃣ Save updates
    await user.save();

    // 6️⃣ Prepare response
    const updatedUser = {
      _id: user._id,
      fullname: user.fullname,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      profile: user.profile,
    };

    return res.status(200).json({
      message: "Profile updated successfully.",
      user: updatedUser,
      success: true,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({
      message: "Something went wrong.",
      success: false,
    });
  }
};


export const fixAllResumeUrls = async (req, res) => {
  try {
    const users = await User.find({ 
      'profile.resume': { $regex: '/image/upload/.*\\.pdf$' } 
    });
    
    let updatedCount = 0;
    
    for (const user of users) {
      if (user.profile.resume) {
        user.profile.resume = user.profile.resume.replace(
          '/image/upload/', 
          '/raw/upload/'
        );
        await user.save();
        updatedCount++;
      }
    }
    
    return res.status(200).json({
      message: `Fixed ${updatedCount} resume URLs`,
      success: true
    });
  } catch (error) {
    console.error('Error fixing URLs:', error);
    return res.status(500).json({
      message: 'Error fixing URLs',
      success: false
    });
  }
};
