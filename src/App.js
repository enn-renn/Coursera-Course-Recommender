import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import "./App.css";

const CourseRecommenderApp = () => {
  // State variables
  const [courses, setCourses] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [allSkills, setAllSkills] = useState([]);
  const [filteredSkills, setFilteredSkills] = useState([]);
  const [selectedSubcategory, setSelectedSubcategory] = useState("All");
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [recommendedCourses, setRecommendedCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [subcategoryMenuOpen, setSubcategoryMenuOpen] = useState(false);
  const [expandedCourses, setExpandedCourses] = useState({});

  // Load and parse CSV data
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        // Fetch CSV from public folder
        const response = await fetch("/data/courserecommendations.csv");
        const text = await response.text();

        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            // Process courses and remove duplicates
            const validCourses = results.data.filter(
              (course) =>
                course.Skills && course["Course Name"] && course.Subcategory
            );

            // Use a Map to deduplicate courses by course URL or course name
            const uniqueCoursesMap = new Map();
            validCourses.forEach((course) => {
              const key = course.course_url || course["Course Name"];
              if (!uniqueCoursesMap.has(key)) {
                uniqueCoursesMap.set(key, course);
              }
            });

            // Convert back to array
            const uniqueCourses = Array.from(uniqueCoursesMap.values());

            setCourses(uniqueCourses);

            // Extract unique subcategories
            const uniqueSubcategories = [
              ...new Set(validCourses.map((course) => course.Subcategory)),
            ].filter(Boolean);
            setSubcategories(uniqueSubcategories.sort());

            // Extract all unique skills
            const skillsSet = new Set();
            validCourses.forEach((course) => {
              if (course.Skills) {
                const skills = course.Skills.split(",").map((skill) =>
                  skill.trim()
                );
                skills.forEach((skill) => {
                  if (skill) skillsSet.add(skill);
                });
              }
            });

            const skillsArray = [...skillsSet].sort();
            setAllSkills(skillsArray);
            setFilteredSkills(skillsArray);

            setIsLoading(false);
          },
          error: (error) => {
            setError(`Error parsing CSV: ${error.message}`);
            setIsLoading(false);
          },
        });
      } catch (error) {
        setError(`Error loading file: ${error.message}`);
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Filter skills based on selected subcategory
  useEffect(() => {
    if (selectedSubcategory === "All") {
      setFilteredSkills(allSkills);
    } else {
      // Get courses in the selected subcategory
      const subcategoryCourses = courses.filter(
        (course) => course.Subcategory === selectedSubcategory
      );

      // Extract skills from these courses
      const subcategorySkillsSet = new Set();
      subcategoryCourses.forEach((course) => {
        if (course.Skills) {
          const skills = course.Skills.split(",").map((skill) => skill.trim());
          skills.forEach((skill) => {
            if (skill) subcategorySkillsSet.add(skill);
          });
        }
      });

      setFilteredSkills([...subcategorySkillsSet].sort());
    }
  }, [selectedSubcategory, courses, allSkills]);

  // Filter skills based on search term
  const displayedSkills = searchTerm
    ? filteredSkills.filter((skill) =>
        skill.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : filteredSkills;

  // Handle subcategory selection
  const handleSubcategorySelect = (subcategory) => {
    setSelectedSubcategory(subcategory);
    setSubcategoryMenuOpen(false);
  };

  // Handle skill selection
  const handleSkillSelect = (skill) => {
    if (!selectedSkills.includes(skill)) {
      setSelectedSkills([...selectedSkills, skill]);
    }
  };

  // Handle skill removal
  const handleRemoveSkill = (skill) => {
    setSelectedSkills(selectedSkills.filter((s) => s !== skill));
  };

  // Handle search input
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Toggle course expansion to show details
  const toggleCourseExpansion = (courseId) => {
    setExpandedCourses((prev) => ({
      ...prev,
      [courseId]: !prev[courseId],
    }));
  };

  // Generate course recommendations based on selected skills
  useEffect(() => {
    if (selectedSkills.length === 0) {
      setRecommendedCourses([]);
      return;
    }

    // Calculate recommendations
    const recommendations = courses.map((course) => {
      // Extract skills from the course
      const courseSkills =
        course.Skills && typeof course.Skills === "string"
          ? course.Skills.split(",").map((skill) => skill.trim())
          : [];

      // Count how many selected skills are covered by this course
      const matchedSkills = selectedSkills.filter((skill) =>
        courseSkills.includes(skill)
      );
      const matchCount = matchedSkills.length;

      // Calculate score - higher if more skills are matched in a single course
      const score =
        matchCount > 0 ? (matchCount / selectedSkills.length) * 100 : 0;

      // Calculate bonus skills (skills in the course but not in selected skills)
      const bonusSkills = courseSkills.filter(
        (skill) => !selectedSkills.includes(skill)
      );

      return {
        ...course,
        matchedSkills,
        matchCount,
        score,
        bonusSkills,
      };
    });

    // Filter out courses with no matching skills and sort by score
    const filteredRecommendations = recommendations
      .filter((course) => course.matchCount > 0)
      .sort((a, b) => {
        // First sort by score (descending)
        if (b.score !== a.score) return b.score - a.score;
        // If scores are equal, sort by rating (descending)
        return b.Ratings - a.Ratings;
      });

    setRecommendedCourses(filteredRecommendations);
  }, [selectedSkills, courses]);

  // Helper function to render course rating stars
  const renderRatingStars = (rating) => {
    if (rating === undefined || rating === null) {
      return <div className="rating">No ratings</div>;
    }

    const ratingNum = typeof rating === "string" ? parseFloat(rating) : rating;
    if (isNaN(ratingNum)) {
      return <div className="rating">Invalid rating</div>;
    }

    const fullStars = Math.floor(ratingNum);
    const hasHalfStar = ratingNum - fullStars >= 0.5;

    return (
      <div className="rating">
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            className={
              i < fullStars
                ? "star-full"
                : i === fullStars && hasHalfStar
                ? "star-half"
                : "star-empty"
            }
          >
            ★
          </span>
        ))}
        <span className="rating-value">{ratingNum.toFixed(1)}</span>
      </div>
    );
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loader"></div>
        <p>Loading course data...</p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="error-container">
        <div className="error-message">
          <p>Error: {error}</p>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div className="app-container">
      <h1 className="app-title">Course Skill Recommender</h1>

      {/* Main content container */}
      <div className="main-content">
        {/* Left panel - Skill selection */}
        <div className="skills-panel">
          <h2>Select Skills to Learn</h2>

          {/* Subcategory dropdown */}
          <div className="dropdown-container">
            <label>Filter Skills by Subcategory</label>
            <div
              className="dropdown-header"
              onClick={() => setSubcategoryMenuOpen(!subcategoryMenuOpen)}
            >
              <span>{selectedSubcategory}</span>
              <span>{subcategoryMenuOpen ? "▲" : "▼"}</span>
            </div>

            {subcategoryMenuOpen && (
              <div className="dropdown-menu">
                <div
                  className="dropdown-item"
                  onClick={() => handleSubcategorySelect("All")}
                >
                  All
                </div>
                {subcategories.map((subcategory) => (
                  <div
                    key={subcategory}
                    className="dropdown-item"
                    onClick={() => handleSubcategorySelect(subcategory)}
                  >
                    {subcategory}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Search input */}
          <div className="search-container">
            <label>Search Skills</label>
            <div className="search-input-container">
              <input
                type="text"
                value={searchTerm}
                onChange={handleSearchChange}
                className="search-input"
                placeholder="Type to search skills..."
              />
              <span className="search-icon">🔍</span>
            </div>
          </div>

          {/* Selected skills */}
          <div className="selected-skills-container">
            <label>Your Selected Skills ({selectedSkills.length})</label>
            <div className="selected-skills">
              {selectedSkills.length === 0 ? (
                <p className="no-skills-message">
                  No skills selected yet. Click on skills below to add them.
                </p>
              ) : (
                <div className="skill-tags">
                  {selectedSkills.map((skill) => (
                    <div key={skill} className="selected-skill-tag">
                      <span>{skill}</span>
                      <button
                        onClick={() => handleRemoveSkill(skill)}
                        className="remove-skill-btn"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Available skills */}
          <div className="available-skills-container">
            <label>Available Skills ({displayedSkills.length})</label>
            <div className="available-skills">
              {displayedSkills.length === 0 ? (
                <p className="no-skills-message">
                  No skills found with current filters.
                </p>
              ) : (
                <div className="skill-tags">
                  {displayedSkills.map((skill) => (
                    <div
                      key={skill}
                      onClick={() => handleSkillSelect(skill)}
                      className={`skill-tag ${
                        selectedSkills.includes(skill) ? "selected" : ""
                      }`}
                    >
                      {skill}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right panel - Recommendations */}
        <div className="recommendations-panel">
          <h2>Course Recommendations</h2>

          {selectedSkills.length === 0 ? (
            <div className="no-selection-message">
              <div className="book-icon">📚</div>
              <p>Select skills to see course recommendations</p>
            </div>
          ) : recommendedCourses.length === 0 ? (
            <div className="no-courses-message">
              <p>No courses found matching your selected skills.</p>
            </div>
          ) : (
            <div className="course-list">
              {recommendedCourses.slice(0, 10).map((course, index) => (
                <div key={`course-${index}`} className="course-card">
                  <div className="course-header">
                    <div className="course-title-container">
                      <h3 className="course-title">
                        {course["Course Name"] || "Unnamed Course"}
                      </h3>
                      <p className="course-subtitle">
                        {course.Organization || "Unknown"}
                        {course.Subcategory ? ` • ${course.Subcategory}` : ""}
                      </p>
                    </div>
                    <div className="course-metrics">
                      <div className="match-score">
                        {Math.round(course.score)}% Match
                      </div>
                      {renderRatingStars(course.Ratings)}
                    </div>
                  </div>

                  {/* Matched skills */}
                  <div className="matched-skills-container">
                    <p className="matched-skills-label">
                      Matched Skills ({course.matchCount}/
                      {selectedSkills.length}):
                    </p>
                    <div className="matched-skills">
                      {course.matchedSkills.map((skill) => (
                        <span key={skill} className="matched-skill-tag">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Course details toggle */}
                  <div className="course-toggle">
                    <button
                      onClick={() => toggleCourseExpansion(`course-${index}`)}
                      className="toggle-details-btn"
                    >
                      {expandedCourses[`course-${index}`] ? (
                        <>▲ Show less</>
                      ) : (
                        <>▼ Show more details</>
                      )}
                    </button>
                  </div>

                  {/* Expanded content */}
                  {expandedCourses[`course-${index}`] && (
                    <div className="expanded-content">
                      {/* Course description */}
                      <div className="course-description">
                        <p className="description-label">Description:</p>
                        <p className="description-text">
                          {course.course_description ||
                            "No description available."}
                        </p>
                      </div>

                      {/* Additional skills */}
                      <div className="bonus-skills-container">
                        <p className="bonus-skills-label">
                          Bonus Skills You'll Learn ({course.bonusSkills.length}
                          ):
                        </p>
                        <div className="bonus-skills">
                          {course.bonusSkills.slice(0, 15).map((skill) => (
                            <span key={skill} className="bonus-skill-tag">
                              {skill}
                            </span>
                          ))}
                          {course.bonusSkills.length > 15 && (
                            <span className="bonus-skill-tag more-tag">
                              +{course.bonusSkills.length - 15} more
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Course details */}
                      <div className="course-details">
                        <div className="detail-item">
                          <span className="detail-label">Difficulty:</span>{" "}
                          {course.Difficulty || "Not specified"}
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Duration:</span>{" "}
                          {course.Duration || "Not specified"}
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Students:</span>{" "}
                          {course.course_students_enrolled || "Not specified"}
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Type:</span>{" "}
                          {course.Type || "Not specified"}
                        </div>
                      </div>

                      {/* Course URL */}
                      {course.course_url && (
                        <div className="course-url-container">
                          <a
                            href={course.course_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="course-url-btn"
                          >
                            View Course
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CourseRecommenderApp;
