import { useState } from "react";
import Layout from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

// Mock job listings for the careers page
const jobListings = [
  {
    id: "job-001",
    title: "Senior Frontend Developer",
    department: "Engineering",
    location: "New York, NY",
    type: "Full-time",
    remote: true,
    posted: "2 weeks ago",
    description: "We're looking for a Senior Frontend Developer to join our Engineering team. The ideal candidate will have strong experience with React, TypeScript, and modern frontend development practices.",
    responsibilities: [
      "Design, develop, and implement user-facing features using React, TypeScript, and related technologies",
      "Collaborate with designers, product managers, and backend developers to deliver high-quality user experiences",
      "Write clean, maintainable, and efficient code",
      "Participate in code reviews and mentor junior developers",
      "Troubleshoot and debug issues in development and production environments"
    ],
    requirements: [
      "5+ years of professional experience in frontend development",
      "Strong proficiency in React, TypeScript, and modern JavaScript",
      "Experience with state management solutions (Redux, Context API, etc.)",
      "Familiarity with modern build tools and workflows (Webpack, Vite, etc.)",
      "Experience with responsive design and cross-browser compatibility",
      "Knowledge of version control systems, preferably Git"
    ]
  },
  {
    id: "job-002",
    title: "UX/UI Designer",
    department: "Design",
    location: "San Francisco, CA",
    type: "Full-time",
    remote: true,
    posted: "3 days ago",
    description: "We're seeking a talented UX/UI Designer to create beautiful, intuitive interfaces for our products. The ideal candidate has a strong portfolio demonstrating their design skills and user-centered approach.",
    responsibilities: [
      "Create wireframes, mockups, and prototypes for new features and products",
      "Conduct user research and usability testing to inform design decisions",
      "Collaborate with product managers and engineers to implement designs",
      "Develop and maintain design systems and documentation",
      "Stay current with UX/UI trends and best practices"
    ],
    requirements: [
      "3+ years of experience in UX/UI design for digital products",
      "Proficiency in design tools such as Figma, Sketch, or Adobe XD",
      "Strong portfolio showcasing your design process and outcomes",
      "Understanding of user-centered design principles and methodologies",
      "Excellent communication and collaboration skills",
      "Experience with design systems and component libraries"
    ]
  },
  {
    id: "job-003",
    title: "Product Marketing Manager",
    department: "Marketing",
    location: "Chicago, IL",
    type: "Full-time",
    remote: false,
    posted: "1 week ago",
    description: "We're looking for a Product Marketing Manager to develop and execute marketing strategies for our products. The ideal candidate will have experience in e-commerce marketing and a passion for creating compelling product narratives.",
    responsibilities: [
      "Develop marketing strategies and campaigns for product launches and updates",
      "Create compelling product messaging and positioning",
      "Collaborate with content, design, and social media teams to execute campaigns",
      "Analyze campaign performance and provide insights to improve future initiatives",
      "Stay current on market trends and competitor activities"
    ],
    requirements: [
      "3+ years of experience in product marketing, preferably in e-commerce",
      "Excellent writing and communication skills",
      "Experience with market research and competitive analysis",
      "Strong analytical skills and data-driven approach",
      "Ability to work cross-functionally with various teams",
      "Bachelor's degree in Marketing, Business, or related field"
    ]
  },
  {
    id: "job-004",
    title: "Customer Success Specialist",
    department: "Customer Support",
    location: "Remote",
    type: "Full-time",
    remote: true,
    posted: "5 days ago",
    description: "We're seeking a Customer Success Specialist to ensure our customers have an exceptional experience with our products and services. The ideal candidate is passionate about customer service and has strong problem-solving skills.",
    responsibilities: [
      "Provide exceptional support to customers through email, chat, and phone",
      "Troubleshoot and resolve customer issues in a timely manner",
      "Document customer feedback and share insights with product teams",
      "Develop and maintain knowledge base articles and support resources",
      "Identify opportunities to improve customer satisfaction and retention"
    ],
    requirements: [
      "2+ years of experience in customer support or success roles",
      "Excellent communication and interpersonal skills",
      "Strong problem-solving abilities",
      "Experience with customer support tools and CRM systems",
      "Ability to work independently and manage multiple priorities",
      "Passion for helping customers and creating positive experiences"
    ]
  },
  {
    id: "job-005",
    title: "Inventory Manager",
    department: "Operations",
    location: "Atlanta, GA",
    type: "Full-time",
    remote: false,
    posted: "2 weeks ago",
    description: "We're looking for an Inventory Manager to oversee our inventory operations and ensure efficient stock management. The ideal candidate has experience in e-commerce inventory management and strong analytical skills.",
    responsibilities: [
      "Manage inventory levels to ensure product availability while minimizing excess stock",
      "Forecast inventory needs based on sales trends and seasonality",
      "Coordinate with suppliers and logistics partners to optimize inventory flow",
      "Implement and maintain inventory management systems and processes",
      "Analyze inventory data to identify opportunities for improvement"
    ],
    requirements: [
      "3+ years of experience in inventory management, preferably in e-commerce",
      "Strong analytical skills and proficiency with inventory management software",
      "Experience with supply chain operations and logistics",
      "Excellent attention to detail and organizational skills",
      "Ability to work cross-functionally with various teams",
      "Bachelor's degree in Supply Chain, Business, or related field"
    ]
  }
];

// Company values
const companyValues = [
  {
    title: "Customer Obsession",
    description: "We start with the customer and work backwards. We work vigorously to earn and keep customer trust."
  },
  {
    title: "Innovation",
    description: "We constantly push boundaries and explore new possibilities. We're not afraid to try new things and learn from failures."
  },
  {
    title: "Ownership",
    description: "We take ownership of our work and think long term. We don't sacrifice long-term value for short-term results."
  },
  {
    title: "Excellence",
    description: "We have high standards and continuously raise the bar. We ensure our products and services are the best they can be."
  },
  {
    title: "Collaboration",
    description: "We believe in the power of teamwork. We work together to achieve common goals and support each other's growth."
  },
  {
    title: "Diversity & Inclusion",
    description: "We value diverse perspectives and create an inclusive environment where everyone can do their best work."
  }
];

// Benefits
const benefits = [
  {
    title: "Comprehensive Health Coverage",
    description: "Medical, dental, and vision insurance for you and your dependents."
  },
  {
    title: "Flexible Work Arrangements",
    description: "Remote work options and flexible hours to help you maintain work-life balance."
  },
  {
    title: "Competitive Compensation",
    description: "Salary packages that reflect your experience, skills, and performance."
  },
  {
    title: "401(k) Matching",
    description: "Company match on your retirement contributions to help you save for the future."
  },
  {
    title: "Professional Development",
    description: "Learning stipend and time allocated for courses, conferences, and certifications."
  },
  {
    title: "Paid Time Off",
    description: "Generous vacation policy, sick leave, and company holidays."
  },
  {
    title: "Parental Leave",
    description: "Paid leave for new parents to spend time with their growing families."
  },
  {
    title: "Employee Discounts",
    description: "Exclusive discounts on our products and services."
  }
];

export default function CareersPage() {
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  
  const selectedJobDetails = selectedJob 
    ? jobListings.find(job => job.id === selectedJob) 
    : null;

  return (
    <Layout>
      <div className="container py-12">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold text-center mb-2">Join Our Team</h1>
          <p className="text-muted-foreground text-center mb-8 max-w-2xl mx-auto">
            We're building a team of passionate individuals who are excited about creating exceptional shopping experiences for our customers.
          </p>

          <Tabs defaultValue="openings" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="openings">Open Positions</TabsTrigger>
              <TabsTrigger value="culture">Our Culture</TabsTrigger>
              <TabsTrigger value="benefits">Benefits</TabsTrigger>
            </TabsList>
            
            <TabsContent value="openings" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                  <div className="bg-muted p-4 rounded-lg mb-4">
                    <h3 className="font-medium mb-2">Filter by Department</h3>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="cursor-pointer hover:bg-secondary">All</Badge>
                      <Badge variant="outline" className="cursor-pointer hover:bg-secondary">Engineering</Badge>
                      <Badge variant="outline" className="cursor-pointer hover:bg-secondary">Design</Badge>
                      <Badge variant="outline" className="cursor-pointer hover:bg-secondary">Marketing</Badge>
                      <Badge variant="outline" className="cursor-pointer hover:bg-secondary">Operations</Badge>
                      <Badge variant="outline" className="cursor-pointer hover:bg-secondary">Customer Support</Badge>
                    </div>
                  </div>
                  
                  <div className="bg-muted p-4 rounded-lg">
                    <h3 className="font-medium mb-2">Filter by Location</h3>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="cursor-pointer hover:bg-secondary">All</Badge>
                      <Badge variant="outline" className="cursor-pointer hover:bg-secondary">Remote</Badge>
                      <Badge variant="outline" className="cursor-pointer hover:bg-secondary">New York</Badge>
                      <Badge variant="outline" className="cursor-pointer hover:bg-secondary">San Francisco</Badge>
                      <Badge variant="outline" className="cursor-pointer hover:bg-secondary">Chicago</Badge>
                      <Badge variant="outline" className="cursor-pointer hover:bg-secondary">Atlanta</Badge>
                    </div>
                  </div>
                </div>
                
                <div className="md:col-span-2">
                  {selectedJob ? (
                    <div>
                      <Button 
                        variant="outline" 
                        className="mb-4"
                        onClick={() => setSelectedJob(null)}
                      >
                        ← Back to all positions
                      </Button>
                      
                      <Card>
                        <CardContent className="pt-6">
                          <div className="mb-4">
                            <h2 className="text-2xl font-semibold">{selectedJobDetails?.title}</h2>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <Badge>{selectedJobDetails?.department}</Badge>
                              <Badge variant="outline">{selectedJobDetails?.location}</Badge>
                              <Badge variant="outline">{selectedJobDetails?.type}</Badge>
                              {selectedJobDetails?.remote && <Badge variant="outline">Remote</Badge>}
                            </div>
                            <p className="text-muted-foreground text-sm mt-2">Posted {selectedJobDetails?.posted}</p>
                          </div>
                          
                          <Separator className="my-4" />
                          
                          <div className="mb-6">
                            <h3 className="font-medium mb-2">About the Role</h3>
                            <p>{selectedJobDetails?.description}</p>
                          </div>
                          
                          <div className="mb-6">
                            <h3 className="font-medium mb-2">Responsibilities</h3>
                            <ul className="list-disc pl-5 space-y-1">
                              {selectedJobDetails?.responsibilities.map((item, index) => (
                                <li key={index}>{item}</li>
                              ))}
                            </ul>
                          </div>
                          
                          <div className="mb-6">
                            <h3 className="font-medium mb-2">Requirements</h3>
                            <ul className="list-disc pl-5 space-y-1">
                              {selectedJobDetails?.requirements.map((item, index) => (
                                <li key={index}>{item}</li>
                              ))}
                            </ul>
                          </div>
                          
                          <Button className="w-full">Apply for this Position</Button>
                        </CardContent>
                      </Card>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {jobListings.map(job => (
                        <Card 
                          key={job.id} 
                          className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => setSelectedJob(job.id)}
                        >
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="font-semibold">{job.title}</h3>
                                <p className="text-muted-foreground">{job.department} • {job.location}</p>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  <Badge variant="outline">{job.type}</Badge>
                                  {job.remote && <Badge variant="outline">Remote</Badge>}
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground">Posted {job.posted}</p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="culture" className="mt-6">
              <div className="max-w-3xl mx-auto">
                <div className="mb-8 text-center">
                  <h2 className="text-2xl font-semibold mb-4">Our Culture</h2>
                  <p className="text-muted-foreground">
                    We believe that great companies are built by great people. Our culture is founded on a set of core values that guide everything we do.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                  {companyValues.map((value, index) => (
                    <Card key={index}>
                      <CardContent className="p-5">
                        <h3 className="font-semibold mb-2">{value.title}</h3>
                        <p className="text-muted-foreground">{value.description}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                
                <div className="text-center">
                  <h2 className="text-2xl font-semibold mb-4">Life at Bazaar</h2>
                  <p className="text-muted-foreground mb-6">
                    From team building events to volunteering opportunities, we create a workplace where you can thrive personally and professionally.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                      <img 
                        src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=870&q=80" 
                        alt="Team collaboration" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                      <img 
                        src="https://images.unsplash.com/photo-1528605105345-5344ea20e269?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=870&q=80" 
                        alt="Company event" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                      <img 
                        src="https://images.unsplash.com/photo-1600880292089-90a7e086ee0c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=774&q=80" 
                        alt="Office space" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="benefits" className="mt-6">
              <div className="max-w-3xl mx-auto">
                <div className="mb-8 text-center">
                  <h2 className="text-2xl font-semibold mb-4">Benefits & Perks</h2>
                  <p className="text-muted-foreground">
                    We offer a comprehensive benefits package to support your health, well-being, and professional growth.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {benefits.map((benefit, index) => (
                    <Card key={index}>
                      <CardContent className="p-5">
                        <h3 className="font-semibold mb-2">{benefit.title}</h3>
                        <p className="text-muted-foreground">{benefit.description}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                
                <div className="mt-10 text-center">
                  <h3 className="font-semibold mb-4">Join Our Team Today</h3>
                  <p className="text-muted-foreground mb-6">
                    Explore our open positions and find your next opportunity at Bazaar.
                  </p>
                  <Button onClick={() => document.querySelector('[value="openings"]')?.dispatchEvent(new Event('click'))}>
                    View Open Positions
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
} 